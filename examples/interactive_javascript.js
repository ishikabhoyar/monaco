// Interactive JavaScript Example
// This example demonstrates interactive input/output

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter your name: ', (name) => {
  console.log(`Hello, ${name}!`);
  
  rl.question('Enter your age: ', (age) => {
    console.log(`You are ${age} years old.`);
    
    rl.question('What is your favorite color? ', (color) => {
      console.log(`Your favorite color is ${color}.`);
      console.log('Thank you for using the interactive example!');
      rl.close();
    });
  });
});
