import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  StringSelectMenuBuilder
} from 'discord.js';

import {
  getCatalog,
  refreshAll,
  searchCatalog,
  getCategories,
  getItemsByCategory,
  getItemById
} from './src/catalog.js';

import { answerWithAI } from './src/ai.js';
import { BRAND, CATEGORY_META, categoryLabel, categoryDescription, trimForDiscord } from './src/theme.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await refreshAll(false);
    console.log('Sword x Staff AI Codex ready.');
  } catch (error) {
    console.error('Initial index load failed:', error.message);
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) return await handleCommand(interaction);
    if (interaction.isStringSelectMenu()) return await handleSelect(interaction);
    if (interaction.isButton()) return await handleButton(interaction);
  } catch (error) {
    console.error(error);
    const message = '⚠️ I had trouble getting that Sword x Staff info. Try again or ask an admin to run `/sxs-refresh`.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: message, components: [] });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  }
});

async function handleCommand(interaction) {
  if (interaction.commandName === 'sxs') {
    await interaction.deferReply();
    const catalog = await getCatalog();
    await interaction.editReply(homePayload(catalog));
    return;
  }

  if (interaction.commandName === 'ask') {
    await interaction.deferReply();
    const question = interaction.options.getString('question');
    const answer = await answerWithAI(question);

    const embed = new EmbedBuilder()
      .setTitle(`💬 ${question}`)
      .setDescription(trimForDiscord(answer.text, 3500))
      .setColor(BRAND.color)
      .addFields(
        { name: 'Confidence', value: answer.confidence, inline: true },
        { name: 'Sources used', value: String(answer.sources.length), inline: true }
      )
      .setFooter({ text: BRAND.footer });

    const image = answer.sources.find(s => s.image)?.image;
    if (image) embed.setImage(image);

    if (answer.sources.length) {
      embed.addFields({
        name: 'Top sources',
        value: answer.sources.slice(0, 3).map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join('\n'),
        inline: false
      });
    }

    await interaction.editReply({
      embeds: [embed],
      components: answer.sources.length ? [sourceButtons(answer.sources), homeButton()] : [homeButton()]
    });
    return;
  }

  if (interaction.commandName === 'sxs-search') {
    await interaction.deferReply();
    const query = interaction.options.getString('query');
    const results = await searchCatalog(query, 10);

    if (!results.length) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🔎 No results')
            .setDescription(`I could not find anything for **${escapeMarkdown(query)}** in the current catalog.`)
            .setColor(BRAND.color)
        ],
        components: [homeButton()]
      });
      return;
    }

    await interaction.editReply({
      embeds: [searchEmbed(query, results)],
      components: [itemsMenu('search', results), homeButton()]
    });
    return;
  }

  if (interaction.commandName === 'sxs-refresh') {
    await interaction.deferReply({ ephemeral: true });
    const catalog = await refreshAll(true);
    await interaction.editReply(`✅ Refreshed the EOG catalog and AI index. Found **${catalog.items.length}** pages/articles.`);
  }
}

async function handleSelect(interaction) {
  const [kind] = interaction.customId.split(':');

  if (kind === 'sxs_category') {
    await interaction.deferUpdate();
    const category = interaction.values[0];
    const items = getItemsByCategory(category).slice(0, 25);

    await interaction.editReply({
      embeds: [categoryEmbed(category, items)],
      components: items.length ? [itemsMenu(category, items), homeButton()] : [homeButton()]
    });
    return;
  }

  if (kind === 'sxs_item') {
    await interaction.deferUpdate();
    const id = interaction.values[0];
    const item = getItemById(id);

    if (!item) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Cache changed')
            .setDescription('That item is no longer in cache. Run `/sxs-refresh` and try again.')
            .setColor(BRAND.color)
        ],
        components: [homeButton()]
      });
      return;
    }

    await interaction.editReply({
      embeds: [itemEmbed(item)],
      components: [singleSourceButton(item.url), homeButton()]
    });
  }
}

async function handleButton(interaction) {
  if (interaction.customId === 'sxs_home') {
    await interaction.deferUpdate();
    const catalog = await getCatalog();
    await interaction.editReply(homePayload(catalog));
  }
}

function homePayload(catalog) {
  const categories = getCategories();

  const categoryLines = categories.map(category => {
    const meta = CATEGORY_META[category] || CATEGORY_META.other;
    const count = catalog.items.filter(item => item.category === category).length;
    return `${meta.emoji} **${meta.label}** — ${count} entries`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🧠⚔️ Sword x Staff AI Codex')
    .setURL(catalog.sourceUrl)
    .setDescription(
      `Ask direct questions or browse EOG.GG info by category.\n\n${categoryLines}\n\nTry **/ask question:best Sage build for support**.`
    )
    .setColor(BRAND.color)
    .addFields(
      { name: 'Best command', value: '`/ask question:<what you need>`', inline: false },
      { name: 'Catalog size', value: `${catalog.items.length} pages/articles`, inline: true },
      { name: 'Last updated', value: catalog.updatedAt ? `<t:${Math.floor(new Date(catalog.updatedAt).getTime() / 1000)}:R>` : 'Not yet', inline: true }
    )
    .setFooter({ text: BRAND.footer });

  return { embeds: [embed], components: [categoryMenu(categories)] };
}

function searchEmbed(query, results) {
  const body = results.map((item, i) => {
    return `**${i + 1}. [${item.title}](${item.url})**\n${categoryLabel(item.category)} • ${trimForDiscord(item.summary, 160)}`;
  }).join('\n\n');

  return new EmbedBuilder()
    .setTitle(`🔎 Search: ${query}`)
    .setDescription(trimForDiscord(body, 3800))
    .setColor(BRAND.color)
    .setFooter({ text: BRAND.footer });
}

function categoryEmbed(category, items) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other;
  const preview = items.slice(0, 8).map((item, i) => {
    return `**${i + 1}. ${item.title}**\n${trimForDiscord(item.summary, 120)}`;
  }).join('\n\n');

  return new EmbedBuilder()
    .setTitle(`${meta.emoji} ${meta.label}`)
    .setDescription(`${meta.description}\n\n${preview || 'No entries found yet.'}`)
    .setColor(BRAND.color)
    .setFooter({ text: BRAND.footer });
}

function itemEmbed(item) {
  const embed = new EmbedBuilder()
    .setTitle(`${categoryLabel(item.category)} • ${item.title}`)
    .setURL(item.url)
    .setDescription(trimForDiscord(item.summary, 1200))
    .setColor(BRAND.color)
    .addFields(
      { name: 'Category', value: categoryLabel(item.category), inline: true },
      { name: 'Updated / Date', value: item.date || 'Not found', inline: true }
    )
    .setFooter({ text: BRAND.footer });

  if (item.image) embed.setImage(item.image);
  if (item.tags?.length) embed.addFields({ name: 'Tags', value: item.tags.slice(0, 12).join(', '), inline: false });
  if (item.headings?.length) embed.addFields({ name: 'Sections', value: trimForDiscord(item.headings.slice(0, 10).join('\n'), 1000), inline: false });
  if (item.tldr?.length) embed.addFields({ name: 'Useful notes', value: trimForDiscord(item.tldr.slice(0, 6).map(x => `• ${x}`).join('\n'), 1000), inline: false });

  return embed;
}

function categoryMenu(categories) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('sxs_category:menu')
    .setPlaceholder('Choose a Sword x Staff category')
    .addOptions(categories.map(category => {
      const meta = CATEGORY_META[category] || CATEGORY_META.other;
      return {
        label: meta.label,
        emoji: meta.emoji,
        value: category,
        description: categoryDescription(category).slice(0, 100)
      };
    }).slice(0, 25));

  return new ActionRowBuilder().addComponents(menu);
}

function itemsMenu(category, items) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`sxs_item:${category}`)
    .setPlaceholder('Choose a result')
    .addOptions(items.map(item => ({
      label: item.title.slice(0, 100),
      value: item.id,
      description: `${categoryLabel(item.category).replace(/^[^ ]+ /, '')} • ${(item.summary || 'EOG Sword x Staff page').slice(0, 80)}`
    })).slice(0, 25));

  return new ActionRowBuilder().addComponents(menu);
}

function singleSourceButton(url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Open EOG Source').setURL(url).setStyle(ButtonStyle.Link)
  );
}

function sourceButtons(sources) {
  const row = new ActionRowBuilder();
  for (const [index, source] of sources.slice(0, 4).entries()) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel(`Source ${index + 1}`)
        .setURL(source.url)
        .setStyle(ButtonStyle.Link)
    );
  }
  return row;
}

function homeButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sxs_home').setLabel('Back to Codex').setEmoji('⚔️').setStyle(ButtonStyle.Secondary)
  );
}

function escapeMarkdown(text) {
  return text.replace(/[*_`~|]/g, '\\$&');
}

client.login(process.env.DISCORD_TOKEN);
