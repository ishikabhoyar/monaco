// Interactive Calculator Example
// This demonstrates how the interactive input/output works

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function calculator() {
  console.log("Welcome to the Interactive Calculator!");
  console.log("Enter 'q' to quit at any time.");
  
  function promptUser() {
    rl.question("Enter an expression (e.g., 2 + 3): ", (expression) => {
      if (expression.toLowerCase() === 'q') {
        console.log("Thank you for using the Interactive Calculator!");
        rl.close();
        return;
      }
      
      try {
        // Safely evaluate the expression
        const result = eval(expression);
        console.log(`Result: ${result}`);
      } catch (e) {
        console.log(`Error: ${e.message}`);
        console.log("Please try again with a valid expression.");
      }
      
      // Continue prompting
      promptUser();
    });
  }
  
  // Start the prompt loop
  promptUser();
}

// Run the calculator
calculator();
