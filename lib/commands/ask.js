const chalk = require('chalk');
const inquirer = require('inquirer');

module.exports = function(program) {
  program
    .command('ask')
    .description('Interactive Q&A')
    .action(async () => {
      const questions = [
        {
          type: 'input',
          name: 'name',
          message: 'What is your name?'
        },
        {
          type: 'list',
          name: 'language',
          message: 'What is your favorite programming language?',
          choices: ['JavaScript', 'Python', 'Java', 'C++']
        }
      ];

      const answers = await inquirer.prompt(questions);
      console.log(chalk.green('\nYour answers:'));
      console.log(chalk.cyan(`Name: ${answers.name}`));
      console.log(chalk.cyan(`Favorite Language: ${answers.language}`));
    });
};
