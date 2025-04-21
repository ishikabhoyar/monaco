# Interactive Calculator Example
# This demonstrates how the interactive input/output works

def calculator():
    print("Welcome to the Interactive Calculator!")
    print("Enter 'q' to quit at any time.")
    
    while True:
        expression = input("Enter an expression (e.g., 2 + 3): ")
        
        if expression.lower() == 'q':
            print("Thank you for using the Interactive Calculator!")
            break
        
        try:
            # Safely evaluate the expression
            result = eval(expression)
            print(f"Result: {result}")
        except Exception as e:
            print(f"Error: {str(e)}")
            print("Please try again with a valid expression.")

# Run the calculator
calculator()
