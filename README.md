<div align="center">
  <div>
    <img src=".github/show.gif" alt="AI Commits"/>
    <h1 align="center">AI-Intl</h1>
  </div>
	<p>A CLI that manage your translations for you with AI 🚀</p>
	<a href="https://www.npmjs.com/package/ai-intl"><img src="https://img.shields.io/npm/v/ai-intl" alt="Current version"></a>
</div>

---

## Setup

> Please note that this project is currently under active development, so while it may not work 100% at this time, we are working diligently to improve it. Thank you for your patience and understanding.

1. Install ai-intl:

   ```sh
   npm install -g ai-intl
   ```

2. Retrieve your API key from [OpenAI](https://platform.openai.com/account/api-keys)

   > Note: If you haven't already, you'll have to create an account and set up billing.

3. Set the key so ai-intl can use it:

   ```sh
   ai-intl config set OPENAI_KEY=<your token>
   ```

4. Generate the config file:

   ```sh
   ai-intl generate
   ```

   ![ai-intl generate cli](.github/cli-demo.gif "ai-intl generate cli")

5. You can now open _ai-intl.config.json_ and personalize your translations.

6. _Optional_ if you want to run ai-intl pre-commit set up the hook.

   ```sh
   ai-intl hook install
   ```

   If you are using husky add <code>npx ai-intl</code> to the pre-commit hook.

## What is all about?

Say goodbye to the complexities of internationalization with our AI-powered CLI application. This cutting-edge technology automates the process of translating and adapting your website for different cultures and languages, saving you time and effort.

## How it works

- CLI that generate for you translations on demand. Run <code>ai-intl translate</code> and it will translate the content for you.
- If enabled, the pre-commit hook 🚀 will check for translation changes in your default locale and adapt all other translations for each pull request.

## Advantages

Once you have finished your development, you no longer have to worry about translating the content. AI will take care of it for you.

### A [jobtome](https://us.p3.jobtome.com/) project

### Maintainers

- **Erik Olivero**: [@ekolivero](https://github.com/erik18xk)

### Thanks

- This project was inspired by [ai-commits](https://github.com/Nutlope/aicommits)
