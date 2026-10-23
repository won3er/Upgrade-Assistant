import { Command } from 'commander';
import { analyzeCommand } from './commands/analyze.js';
import { checkCommand } from './commands/check.js';
import { doctorCommand } from './commands/doctor.js';
import { migrateCommand } from './commands/migrate.js';
import { planCommand } from './commands/plan.js';
import { pluginsCommand } from './commands/plugins.js';
import { reportCommand } from './commands/report.js';
import { verifyCommand } from './commands/verify.js';
import { runCommand } from './commands/shared.js';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('upgrade-assistant')
  .description(
    'The migration engine for your codebase.\n' +
      'Understands your project, finds the breaking changes that actually affect it,\n' +
      'plans the migration and applies the safe parts automatically.',
  )
  .version(VERSION);

const dirOption = ['-d, --dir <path>', 'project directory', process.cwd()] as const;
const targetOption = ['-t, --target <pkg@version...>', 'pin a target version (repeatable)'] as const;
const onlyOption = ['--only <rule-id...>', 'restrict to these rule ids'] as const;
const skipOption = ['--skip <rule-id...>', 'ignore these rule ids'] as const;

program
  .command('analyze')
  .description('analyze the project: upgrades, impacted files, risk and effort')
  .option(...dirOption)
  .option('--json', 'machine-readable output')
  .option('--offline', 'skip registry lookups')
  .option(...targetOption)
  .option(...onlyOption)
  .option(...skipOption)
  .option('--explain', 'add an AI-written briefing (requires ANTHROPIC_API_KEY)')
  .action((flags) => runCommand(() => analyzeCommand(flags)));

program
  .command('check')
  .description('fast version check for supported packages (no AST analysis)')
  .option(...dirOption)
  .option('--json', 'machine-readable output')
  .option('--offline', 'skip registry lookups')
  .action((flags) => runCommand(() => checkCommand(flags)));

program
  .command('plan')
  .description('show the ordered migration plan with effort estimates')
  .option(...dirOption)
  .option('--json', 'machine-readable output')
  .option('--offline', 'skip registry lookups')
  .option(...targetOption)
  .option(...onlyOption)
  .option(...skipOption)
  .action((flags) => runCommand(() => planCommand(flags)));

program
  .command('migrate')
  .description('apply dependency updates and automatic fixes (safely)')
  .option(...dirOption)
  .option('--dry-run', 'preview diffs without writing anything')
  .option('-y, --yes', 'skip the confirmation prompt')
  .option('--force', 'allow running on a dirty git tree')
  .option('--no-branch', 'do not create a dedicated branch')
  .option('--no-verify', 'skip post-migration typecheck')
  .option('--offline', 'skip registry lookups')
  .option(...targetOption)
  .option(...onlyOption)
  .option(...skipOption)
  .action((flags) => runCommand(() => migrateCommand(flags)));

program
  .command('verify')
  .description('verify the project: typecheck, plus the test suite with --tests')
  .option(...dirOption)
  .option('--tests', "also run the project's test script")
  .action((flags) => runCommand(() => verifyCommand(flags)));

program
  .command('doctor')
  .description('check the environment (node, git, registry, plugins, AI)')
  .option(...dirOption)
  .option('--offline', 'skip registry lookups')
  .action((flags) => runCommand(() => doctorCommand(flags)));

program
  .command('report')
  .description('regenerate MIGRATION_REPORT.md from the last analysis')
  .option(...dirOption)
  .option('--print', 'also print the report to stdout')
  .action((flags) => runCommand(() => reportCommand(flags)));

program
  .command('plugins')
  .description('list installed plugins and what they detected')
  .option(...dirOption)
  .action((flags) => runCommand(() => pluginsCommand(flags)));

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
