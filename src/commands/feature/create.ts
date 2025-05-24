import {Command, Flags} from '@oclif/core'
import chalk from 'chalk'
import fs from 'fs'
import inquirer from 'inquirer'
import logSymbols from 'log-symbols'
import ora from 'ora'
import path from 'path'

export default class FeatureCreate extends Command {
  static override args = {}
  static override description = 'Create a new feature with optional page and styles.'
  static override examples = ['<%= config.bin %> <%= command.id %> --name=my-feature --page --section=front']
  static override flags = {
    force: Flags.boolean({char: 'f'}),
    name: Flags.string({char: 'n', description: 'Feature name (e.g. my-feature)'}),
    page: Flags.boolean({char: 'p', description: 'Create a page for this feature'}),
    section: Flags.string({
      char: 's',
      description: 'Section for the page (front, middle, back)',
      options: ['front', 'middle', 'back'],
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(FeatureCreate)
    let {name, page, section} = flags

    // Prompt for missing name
    if (!name) {
      this.log('')
      const nameAnswer = await inquirer.prompt({
        type: 'input',
        name: 'featureName',
        message: '🚀 Enter the feature name (e.g. my-feature): ',
        validate: (input: string) =>
          /^[a-zA-Z0-9_-]+$/.test(input) ||
          '❌ Invalid feature name. Use only letters, numbers, dashes, and underscores.',
      })
      name = nameAnswer.featureName
      this.log('')
    }

    // Prompt for page if not provided
    if (typeof page !== 'boolean') {
      const pageAnswer = await inquirer.prompt({
        type: 'confirm',
        name: 'wantsPage',
        message: '👀 Create a page for this feature?',
        default: false,
      })
      page = pageAnswer.wantsPage
      this.log('')
    }

    // Prompt for section if page is true and section not provided
    if (page && !section) {
      const sectionAnswer = await inquirer.prompt({
        type: 'list',
        name: 'section',
        message: '🌐 In which part should the page be created?',
        choices: ['middle', 'front', 'back'],
      })
      section = sectionAnswer.section
      this.log('')
    }

    await this.createFeatureFiles(name!, !!page, section ?? null)
  }

  async createFeatureFiles(featureName: string, createPage: boolean, section: string | null) {
    const baseDir = path.join(process.cwd(), 'src/features')
    const appDir = path.join(process.cwd(), 'src/app')
    const stylesPagesDir = path.join(process.cwd(), 'src/styles/pages')

    const templates = {
      'index.ts': `export * from './service';\nexport * from './store';\nexport * from './types';\nexport * from './utils';\n`,
      'service.ts': `export const fetchFeatureData = async () => {\n  // Replace with actual API logic\n  return Promise.resolve({ data: 'example data' });\n};\n`,
      'store.ts': `import { create } from 'zustand';\n\nimport { FeatureState } from './types';\n\nexport const useFeatureStore = create<FeatureState>((set) => ({\n  data: '',\n  setData: (data: string) => set({ data }),\n}));\n`,
      'utils.ts': `\nexport function formatFeatureName(name: string) {\n  return name.toUpperCase();\n}\n`,
      'types.ts': `\nexport interface Feature {\n  id: string;\n  name: string;\n}\n\nexport interface FeatureState {\n  data: string;\n  setData: (data: string) => void;\n}\n`,
    }

    // Timeline step 1: Create folder structure
    const spinner1 = ora({text: chalk.cyan('1. Creating folder structure...'), spinner: 'dots'}).start()
    const featureDir = path.join(baseDir, featureName)
    if (fs.existsSync(featureDir)) {
      spinner1.fail(chalk.red(`${logSymbols.error} Feature '${featureName}' already exists.`))
      this.log('')
      this.log(chalk.gray('──────────────────────────────────────────────'))
      process.exit(1)
    }
    fs.mkdirSync(featureDir, {recursive: true})
    spinner1.succeed(chalk.green(`${logSymbols.success} Created folder structure`))
    this.log('')

    // Timeline step 2: Write template files
    const spinner2 = ora({text: chalk.cyan('2. Generating service and types...'), spinner: 'dots'}).start()
    Object.entries(templates).forEach(([file, content]) => {
      fs.writeFileSync(path.join(featureDir, file), content)
    })
    spinner2.succeed(chalk.green(`${logSymbols.success} Generated service and types`))
    this.log('')

    // Timeline step 3: Page + SCSS files (if needed)
    let didPage = false
    if (createPage && section) {
      const spinner3 = ora({text: chalk.cyan('3. Scaffolding page + SCSS files...'), spinner: 'dots'}).start()
      const sectionMap: Record<string, string> = {
        front: '(front)',
        middle: '(middle)',
        back: '(back)',
      }
      const sectionDir = sectionMap[section as keyof typeof sectionMap]
      if (!sectionDir) {
        spinner3.fail(chalk.red(`${logSymbols.error} Invalid section.`))
        this.log('')
        this.log(chalk.gray('──────────────────────────────────────────────'))
        process.exit(1)
      }
      const pageDir = path.join(appDir, sectionDir, featureName)
      const scssDir = path.join(stylesPagesDir, section, featureName)
      const pageFile = path.join(pageDir, 'page.tsx')
      const scssFile = path.join(scssDir, 'index.scss')

      if (!fs.existsSync(pageDir)) {
        fs.mkdirSync(pageDir, {recursive: true})
      }
      if (!fs.existsSync(scssDir)) {
        fs.mkdirSync(scssDir, {recursive: true})
      }
      // Create _components directory at the same level as page.tsx
      const componentsDir = path.join(pageDir, '_components')
      if (!fs.existsSync(componentsDir)) {
        fs.mkdirSync(componentsDir)
      }
      const scssImport = `import '@/styles/pages/${section}/${featureName}/index.scss';\n`
      const scssContent = `@use '../../../base' as *;\n\n.${featureName} {\n  // Styles for ${featureName} page\n}\n`
      const pageContent =
        scssImport +
        `\nexport default function ${this.capitalize(
          featureName,
        )}Page() {\n  return (\n    <div>\n      <h1>${this.capitalize(featureName)} Page</h1>\n    </div>\n  );\n}\n`
      fs.writeFileSync(pageFile, pageContent)
      fs.writeFileSync(scssFile, scssContent)
      spinner3.succeed(chalk.green(`${logSymbols.success} Page + SCSS files scaffolded`))
      this.log('')
      didPage = true
    }

    // Timeline summary
    this.log(chalk.gray('──────────────────────────────────────────────'))
    this.log('')
    this.log(chalk.green.bold(`${logSymbols.success} Done!`))
    this.log('')
    this.log(chalk.gray('──────────────────────────────────────────────\n'))
  }

  capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}
