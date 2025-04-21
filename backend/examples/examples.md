# Monaco Code Execution Examples

This document provides examples of code submissions for each supported language.

## Python

```json
{
  "language": "python",
  "code": "name = input('Enter your name: ')\nprint(f'Hello, {name}!')\nfor i in range(5):\n    print(f'Count: {i}')",
  "input": "World"
}
```

Expected output:
```
Enter your name: Hello, World!
Count: 0
Count: 1
Count: 2
Count: 3
Count: 4
```

## JavaScript

```json
{
  "language": "javascript",
  "code": "const readline = require('readline');\nconst rl = readline.createInterface({\n  input: process.stdin,\n  output: process.stdout\n});\n\nrl.question('Enter your name: ', (name) => {\n  console.log(`Hello, ${name}!`);\n  for (let i = 0; i < 5; i++) {\n    console.log(`Count: ${i}`);\n  }\n  rl.close();\n});",
  "input": "World"
}
```

Expected output:
```
Enter your name: Hello, World!
Count: 0
Count: 1
Count: 2
Count: 3
Count: 4
```

## Go

```json
{
  "language": "go",
  "code": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n\t\"strings\"\n)\n\nfunc main() {\n\tfmt.Print(\"Enter your name: \")\n\treader := bufio.NewReader(os.Stdin)\n\tname, _ := reader.ReadString('\\n')\n\tname = strings.TrimSpace(name)\n\tfmt.Printf(\"Hello, %s!\\n\", name)\n\tfor i := 0; i < 5; i++ {\n\t\tfmt.Printf(\"Count: %d\\n\", i)\n\t}\n}",
  "input": "World"
}
```

Expected output:
```
Enter your name: Hello, World!
Count: 0
Count: 1
Count: 2
Count: 3
Count: 4
```

## Java

```json
{
  "language": "java",
  "code": "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        System.out.print(\"Enter your name: \");\n        String name = scanner.nextLine();\n        System.out.println(\"Hello, \" + name + \"!\");\n        for (int i = 0; i < 5; i++) {\n            System.out.println(\"Count: \" + i);\n        }\n        scanner.close();\n    }\n}",
  "input": "World"
}
```

Expected output:
```
Enter your name: Hello, World!
Count: 0
Count: 1
Count: 2
Count: 3
Count: 4
```

## C

```json
{
  "language": "c",
  "code": "#include <stdio.h>\n\nint main() {\n    char name[100];\n    printf(\"Enter your name: \");\n    scanf(\"%s\", name);\n    printf(\"Hello, %s!\\n\", name);\n    for (int i = 0; i < 5; i++) {\n        printf(\"Count: %d\\n\", i);\n    }\n    return 0;\n}",
  "input": "World"
}
```

Expected output:
```
Enter your name: Hello, World!
Count: 0
Count: 1
Count: 2
Count: 3
Count: 4
```

## C++

```json
{
  "language": "cpp",
  "code": "#include <iostream>\n#include <string>\n\nint main() {\n    std::string name;\n    std::cout << \"Enter your name: \";\n    std::cin >> name;\n    std::cout << \"Hello, \" << name << \"!\" << std::endl;\n    for (int i = 0; i < 5; i++) {\n        std::cout << \"Count: \" << i << std::endl;\n    }\n    return 0;\n}",
  "input": "World"
}
```

Expected output:
```
Enter your name: Hello, World!
Count: 0
Count: 1
Count: 2
Count: 3
Count: 4
```

## Testing with cURL

You can test these examples using cURL:

```bash
curl -X POST http://localhost:8080/submit \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "name = input(\"Enter your name: \")\nprint(f\"Hello, {name}!\")\nfor i in range(5):\n    print(f\"Count: {i}\")",
    "input": "World"
  }'
```

This will return a submission ID:

```json
{
  "id": "6423259c-ee14-c5aa-1c90-d5e989f92aa1"
}
```

You can then check the status and result:

```bash
curl http://localhost:8080/status?id=6423259c-ee14-c5aa-1c90-d5e989f92aa1
```

```bash
curl http://localhost:8080/result?id=6423259c-ee14-c5aa-1c90-d5e989f92aa1
```
