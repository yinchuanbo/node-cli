const chalk = require('chalk');

module.exports = function(program) {
  program
    .command('random')
    .description('Generate a random number')
    .option('-m, --min <number>', 'minimum number', '0')
    .option('-M, --max <number>', 'maximum number', '100')
    .action((options) => {
      const min = parseInt(options.min);
      const max = parseInt(options.max);
      const random = Math.floor(Math.random() * (max - min + 1)) + min;
      console.log(chalk.blue(`Random number between ${min} and ${max}: ${random}`));
    });
};
