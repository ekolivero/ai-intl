import { command } from "cleye";
import { multiselect, outro, text, spinner } from "@clack/prompts";
import fs, { existsSync } from "fs";
import { green } from "kolorist";

export default command(
  {
    name: "generate",
  },
  async () => {
    if (existsSync("ai-intl.config.json")) {
      console.log(green("✔"), "   Config file already exists");
      console.log("😆   You can edit it manually");
      return;
    }

    const translationsPath = await text({
      message: "Where are your translation files, provide relative path",
      placeholder: "./src/locales",
      validate: (value) => {
        if (existsSync(value)) {
          return "";
        }
        return "Path does not exist";
      },
    });

    const defaultLocale = await text({
      message: "What is your default locale?",
      placeholder: "en-US",
      validate: (value) => {
        if (value) {
          return "";
        }
        return "Default locale is required";
      },
    });

    const locales = await multiselect({
      message:
        "Now select some initial locales, consider that you can add more later inside ai-intl.config.js and skip for now",
      options: [
        { name: "en-US", value: "en-US" },
        { name: "es-ES", value: "es-ES" },
        { name: "fr-FR", value: "fr-FR" },
        { name: "de-DE", value: "de-DE" },
        { name: "it-IT", value: "it-IT" },
        { name: "pt-BR", value: "pt-BR" },
        { name: "nl-NL", value: "nl-NL" },
        { name: "ru-RU", value: "ru-RU" },
        { name: "ja-JP", value: "ja-JP" },
        { name: "zh-CN", value: "zh-CN" },
      ],
      required: false,
    });

    const config = `{
    "translationsPath": "${String(translationsPath)}",
    "defaultLocale": "${String(defaultLocale)}",
    "locales": ${JSON.stringify(locales)}\n}`;

    const s = spinner();

    s.start("Generating config file");
    fs.writeFileSync("ai-intl.config.json", config);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    s.stop();

    outro("It is all setted, enjoy your auto translations :)");
  }
);
