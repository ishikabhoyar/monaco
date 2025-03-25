import requests
import concurrent.futures
import time

# Define the endpoint URLs
POST_URL = "http://localhost:8080/submit"
GET_URL = "http://localhost:8080/result?id={}"

# Define the request bodies
cpp_payload = {
    "language": "cpp",
    "code": """#include <iostream>\n#include <string>\n\nint main() {\n    std::string name;\n    std::cout << \"Enter your name: \";\n    std::cin >> name;\n    std::cout << \"Hello, \" << name << \"!\" << std::endl;\n    return 0;\n}""",
    "input": "Alice"
}

java_payload = {
    "language": "java",
    "code": """import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        System.out.print(\"Enter your name: \");\n        String name = scanner.nextLine();\n        System.out.println(\"Hello, \" + name + \"!\");\n        scanner.close();\n    }\n}""",
    "input": "Jane"
}

def send_request(index):
    """Sends a POST request and returns the task ID."""
    payload = cpp_payload if index % 2 == 0 else java_payload
    for _ in range(3):  # Retry up to 3 times
        try:
            response = requests.post(POST_URL, json=payload, timeout=10)
            if response.status_code == 200:
                task_id = response.json().get("id")
                print(f"Request {index} sent. Task ID: {task_id}")
                return task_id
        except requests.exceptions.RequestException as e:
            print(f"Request {index} failed: {e}")
        time.sleep(1)
    return None

def get_result(task_id):
    """Polls the result endpoint until completion."""
    if not task_id:
        return None
    max_retries = 50  # Prevent infinite loop
    retries = 0
    while retries < max_retries:
        try:
            response = requests.get(GET_URL.format(task_id), timeout=10)
            if response.status_code == 200:
                result = response.json()
                if result.get("status") == "completed":
                    print(f"Task {task_id} completed.")
                    return result
            time.sleep(1)  # Poll every second
            retries += 1
        except requests.exceptions.RequestException as e:
            print(f"Error fetching result for {task_id}: {e}")
    print(f"Task {task_id} did not complete in time.")
    return None

def main():
    start_time = time.time()
    task_ids = []

    print("Sending 500 requests...")

    # Send 500 requests concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = {executor.submit(send_request, i): i for i in range(500)}
        for future in concurrent.futures.as_completed(futures):
            task_id = future.result()
            if task_id:
                task_ids.append(task_id)

    print(f"Sent {len(task_ids)} requests. Waiting for results...")

    # Fetch results
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = {executor.submit(get_result, task_id): task_id for task_id in task_ids}
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            if result:
                results.append(result)

    # Calculate execution stats
    total_time = time.time() - start_time
    waiting_times = [r["totalTime"] for r in results if "totalTime" in r]
    avg_waiting_time = sum(waiting_times) / len(waiting_times) if waiting_times else 0

    print("\nExecution Stats:")
    print(f"Total Execution Time: {total_time:.2f}s")
    print(f"Total Requests Processed: {len(results)}/{len(task_ids)}")
    print(f"Average Waiting Time: {avg_waiting_time:.2f}ms")
    print(f"Min Waiting Time: {min(waiting_times, default=0)}ms")
    print(f"Max Waiting Time: {max(waiting_times, default=0)}ms")

if __name__ == "__main__":
    main()
