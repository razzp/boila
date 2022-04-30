const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const Handlebars = require('handlebars');
const clipboard = require('clipboardy');

const PACKAGE_NAME = 'boila';

Handlebars.registerHelper({
    shouldShowScriptTag: (enabled, location, thisLocation) =>
        enabled && location === thisLocation,
});

const questions = [
    {
        type: 'confirm',
        name: 'hasLang',
        message: 'Include language?',
    },
    {
        type: 'input',
        name: 'lang',
        message: 'Document language:',
        default: getLocale(),
        when: ({ hasLang }) => hasLang,
    },
    {
        type: 'checkbox',
        name: 'metaTags',
        message: 'Include meta tags:',
        choices: [
            {
                name: '<meta charset="UTF-8">',
                checked: true,
            },
            {
                name: '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
                checked: true,
            },
            {
                name: '<meta http-equiv="X-UA-Compatible" content="ie=edge">',
                checked: false,
            },
        ],
    },
    {
        type: 'input',
        name: 'title',
        message: 'Document title:',
        default: 'Untitled',
    },
    {
        type: 'confirm',
        name: 'hasStyleTag',
        message: 'Include a stylesheet?',
        default: false,
    },
    {
        type: 'input',
        name: 'styleTagHref',
        message: 'Stylesheet path:',
        default: '/dist/main.css',
        when: ({ hasStyleTag }) => hasStyleTag,
    },
    {
        type: 'confirm',
        name: 'hasScriptTag',
        message: 'Include a script?',
        default: false,
    },
    {
        type: 'list',
        name: 'scriptTagLocation',
        message: 'Script location:',
        choices: [
            {
                name: 'In the <head>',
                value: 0,
            },
            {
                name: 'At the start of <body>',
                value: 1,
            },
            {
                name: 'At the end of <body>',
                value: 2,
            },
        ],
        when: ({ hasScriptTag }) => hasScriptTag,
    },
    {
        type: 'input',
        name: 'scriptTagSrc',
        message: 'Script path:',
        default: '/dist/main.js',
        when: ({ hasScriptTag }) => hasScriptTag,
    },
    {
        type: 'checkbox',
        name: 'scriptTagAttrs',
        message: 'Script attributes:',
        choices: ({ scriptTagLocation, scriptTagSrc }) => [
            {
                name: 'type="module"',
                checked: scriptTagSrc.trim().match(/\.mjs$/i),
            },
            {
                name: 'async',
                checked: false,
            },
            {
                name: 'defer',
                checked: [0, 1].includes(scriptTagLocation),
            },
        ],
        when: ({ hasScriptTag }) => hasScriptTag,
    },
];

const followUpQuestions = [
    {
        type: 'list',
        name: 'nextAction',
        message: 'What would you like to do next?',
        choices: [
            {
                name: "I'm finished",
                value: 0,
            },
            {
                name: 'Copy to the clipboard',
                value: 1,
            },
            {
                name: 'Save to disk',
                value: 2,
            },
        ],
    },
    {
        type: 'input',
        name: 'path',
        message: 'Output path:',
        default: process.cwd(),
        when: ({ nextAction }) => nextAction === 2,
    },
    {
        type: 'input',
        name: 'filename',
        message: 'File name:',
        default: 'index.html',
        when: ({ nextAction, path }) => nextAction === 2 && needsFileName(path),
    },
];

function getLocale() {
    try {
        // Unsupported in Node < 13, so wrap in try/catch.
        return Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
        // Return a fallback value instead.
        return 'en';
    }
}

function needsFileName(input) {
    // Get the 'base' parts of the input path.
    const { name, ext } = path.parse(input);

    // Return true if one or more parts is empty, and false otherwise.
    return [name, ext].some((part) => part.trim() === '');
}

async function copyToClipboard(output) {
    // Copy to clipboard.
    await clipboard.write(output);

    // Log the result.
    console.log('Successfully copied boilerplate to clipboard!');
}

async function saveToDisk(output, answers) {
    // Build a file path based on the answers given.
    const filePath =
        typeof answers.filename !== 'undefined'
            ? path.join(answers.path, answers.filename)
            : answers.path;

    if (fs.existsSync(filePath)) {
        // The file already exists, so we'll prompt the user.
        const { overwriteFile } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'overwriteFile',
                message: 'File already exists. Overwrite?',
            },
        ]);

        if (!overwriteFile) {
            // User doesn't want to overwrite, so bail out.
            return;
        }
    }

    // If we haven't already bailed out then write the file.
    await writeFile(filePath, output);
}

async function writeFile(path, content) {
    // Write the file to disk.
    await fs.promises.writeFile(path, content);

    // Log the result.
    console.log(`Successfully saved boilerplate to "${path}"`);
}

async function run() {
    // Load and compile the Handlebars template.
    const render = await fs.promises
        .readFile(path.join(__dirname, 'template.hbs'), 'utf8')
        .then((template) => Handlebars.compile(template));

    // Render the boilerplate.
    const output = render({
        ...(await inquirer.prompt(questions)),
        packageName: PACKAGE_NAME,
    });

    console.log('\n');
    console.log('Your boilerplate:');
    console.log('\n');
    console.log(output);
    console.log('\n');

    // Ask the user some follow-up questions.
    const followUpAnswers = await inquirer.prompt(followUpQuestions);

    switch (followUpAnswers.nextAction) {
        case 1:
            // User wants to copy output to the clipboard.
            await copyToClipboard(output);
            break;
        case 2:
            // User wants to save output to disk.
            await saveToDisk(output, followUpAnswers);
            break;
    }

    // Say thanks!
    console.log(`Thanks for using ${PACKAGE_NAME}!`);
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
