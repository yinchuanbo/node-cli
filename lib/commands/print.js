const chalk = require('chalk');

module.exports = function(program) {
  program
    .command('print <text>')
    .description('Print colorful text')
    .option('-c, --color <color>', 'text color', 'green')
    .action((text, options) => {
      console.log(chalk[options.color](text));
    });
};
