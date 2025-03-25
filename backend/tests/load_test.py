import requests
import concurrent.futures
import time
import statistics
import matplotlib.pyplot as plt
import numpy as np

# Define the endpoint URLs
POST_URL = "http://localhost:8080/submit"
GET_URL_STATUS = "http://localhost:8080/status?id={}"
GET_URL_RESULT = "http://localhost:8080/result?id={}"
GET_URL_STATS = "http://localhost:8080/queue-stats"

# Test payloads for different languages
PAYLOADS = {
    "python": {
        "language": "python",
        "code": "print('Hello, Load Test!')",
    },
    "java": {
        "language": "java",
        "code": "public class Solution { public static void main(String[] args) { System.out.println(\"Hello, Load Test!\"); } }",
    },
    "c": {
        "language": "c",
        "code": "#include <stdio.h>\nint main() { printf(\"Hello, Load Test!\\n\"); return 0; }",
    },
    "cpp": {
        "language": "cpp",
        "code": "#include <iostream>\nint main() { std::cout << \"Hello, Load Test!\" << std::endl; return 0; }",
    }
}

def send_request(language, index):
    """Sends a POST request and returns (task_id, time_taken)."""
    payload = PAYLOADS[language]
    start_time = time.time()
    try:
        response = requests.post(POST_URL, json=payload, timeout=10)
        end_time = time.time()
        if response.status_code == 202:
            return response.json().get("id"), end_time - start_time
        else:
            print(f"Request {index} failed with status {response.status_code}")
            return None, end_time - start_time
    except requests.exceptions.RequestException as e:
        end_time = time.time()
        print(f"Request {index} error: {e}")
        return None, end_time - start_time

def wait_for_result(task_id, index):
    """Waits for a result and returns (result, time_taken)."""
    if not task_id:
        return None, 0
    
    start_time = time.time()
    max_retries = 30
    retry_interval = 0.5  # seconds
    
    for _ in range(max_retries):
        try:
            response = requests.get(GET_URL_RESULT.format(task_id), timeout=10)
            if response.status_code == 200:
                result = response.json()
                if result.get("status") in ["completed", "failed"]:
                    end_time = time.time()
                    return result, end_time - start_time
            time.sleep(retry_interval)
        except requests.exceptions.RequestException as e:
            print(f"Error checking result for task {index}: {e}")
    
    end_time = time.time()
    print(f"Timed out waiting for result of task {index}")
    return None, end_time - start_time

def run_test(concurrency, requests_per_language):
    """Runs a load test with the specified parameters."""
    languages = list(PAYLOADS.keys())
    all_results = {lang: [] for lang in languages}
    submit_times = {lang: [] for lang in languages}
    wait_times = {lang: [] for lang in languages}
    success_rates = {lang: 0 for lang in languages}
    
    # Keep track of all submissions for each language
    total_per_language = {lang: 0 for lang in languages}
    successful_per_language = {lang: 0 for lang in languages}
    
    start_time = time.time()
    
    # Create a list of tasks
    tasks = []
    for lang in languages:
        for i in range(requests_per_language):
            tasks.append((lang, i))
    
    print(f"Running load test with {concurrency} concurrent connections")
    print(f"Sending {requests_per_language} requests per language ({len(languages)} languages)")
    
    # Submit all tasks
    task_ids = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        future_to_task = {executor.submit(send_request, lang, i): (lang, i) for lang, i in tasks}
        for future in concurrent.futures.as_completed(future_to_task):
            lang, i = future_to_task[future]
            total_per_language[lang] += 1
            try:
                task_id, submit_time = future.result()
                if task_id:
                    task_ids[(lang, i)] = task_id
                    submit_times[lang].append(submit_time)
            except Exception as e:
                print(f"Error submitting {lang} task {i}: {e}")
    
    print(f"Submitted {len(task_ids)} tasks successfully")
    
    # Wait for all results
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        future_to_task = {executor.submit(wait_for_result, task_ids.get((lang, i)), i): (lang, i) 
                         for lang, i in tasks if (lang, i) in task_ids}
        for future in concurrent.futures.as_completed(future_to_task):
            lang, i = future_to_task[future]
            try:
                result, wait_time = future.result()
                if result and result.get("status") == "completed":
                    successful_per_language[lang] += 1
                    all_results[lang].append(result)
                    wait_times[lang].append(wait_time)
            except Exception as e:
                print(f"Error waiting for {lang} task {i}: {e}")
    
    end_time = time.time()
    total_time = end_time - start_time
    
    # Calculate success rates
    for lang in languages:
        if total_per_language[lang] > 0:
            success_rates[lang] = (successful_per_language[lang] / total_per_language[lang]) * 100
        else:
            success_rates[lang] = 0
    
    # Calculate statistics
    stats = {
        "total_time": total_time,
        "requests_per_second": len(task_ids) / total_time if total_time > 0 else 0,
        "success_rate": sum(success_rates.values()) / len(success_rates) if success_rates else 0,
        "submit_times": {
            lang: {
                "avg": statistics.mean(times) if times else 0,
                "min": min(times) if times else 0,
                "max": max(times) if times else 0,
                "p95": np.percentile(times, 95) if times else 0
            } for lang, times in submit_times.items()
        },
        "wait_times": {
            lang: {
                "avg": statistics.mean(times) if times else 0,
                "min": min(times) if times else 0,
                "max": max(times) if times else 0,
                "p95": np.percentile(times, 95) if times else 0
            } for lang, times in wait_times.items()
        },
        "success_rates": success_rates
    }
    
    return stats, all_results

def print_stats(stats):
    """Prints test statistics."""
    print("\n=== Load Test Results ===")
    print(f"Total time: {stats['total_time']:.2f}s")
    print(f"Requests per second: {stats['requests_per_second']:.2f}")
    print(f"Overall success rate: {stats['success_rate']:.2f}%")
    
    print("\n== Submit Times (seconds) ==")
    for lang, times in stats["submit_times"].items():
        print(f"{lang:<6}: avg={times['avg']:.4f}, min={times['min']:.4f}, max={times['max']:.4f}, p95={times['p95']:.4f}")
    
    print("\n== Wait Times (seconds) ==")
    for lang, times in stats["wait_times"].items():
        print(f"{lang:<6}: avg={times['avg']:.4f}, min={times['min']:.4f}, max={times['max']:.4f}, p95={times['p95']:.4f}")
    
    print("\n== Success Rates ==")
    for lang, rate in stats["success_rates"].items():
        print(f"{lang:<6}: {rate:.2f}%")

def plot_results(stats):
    """Creates visualizations of test results."""
    languages = list(stats["submit_times"].keys())
    
    # Plot submit times
    plt.figure(figsize=(12, 10))
    
    plt.subplot(2, 2, 1)
    plt.title("Average Submit Time by Language")
    avg_times = [stats["submit_times"][lang]["avg"] for lang in languages]
    plt.bar(languages, avg_times)
    plt.ylabel("Time (seconds)")
    
    plt.subplot(2, 2, 2)
    plt.title("Average Wait Time by Language")
    avg_wait_times = [stats["wait_times"][lang]["avg"] for lang in languages]
    plt.bar(languages, avg_wait_times)
    plt.ylabel("Time (seconds)")
    
    plt.subplot(2, 2, 3)
    plt.title("Success Rate by Language")
    success_rates = [stats["success_rates"][lang] for lang in languages]
    plt.bar(languages, success_rates)
    plt.ylabel("Success Rate (%)")
    plt.ylim(0, 100)
    
    plt.subplot(2, 2, 4)
    plt.title("95th Percentile Wait Time by Language")
    p95_times = [stats["wait_times"][lang]["p95"] for lang in languages]
    plt.bar(languages, p95_times)
    plt.ylabel("Time (seconds)")
    
    plt.tight_layout()
    plt.savefig("load_test_results.png")
    print("Results saved to load_test_results.png")

def main():
    # Run tests with different concurrency levels
    concurrency_levels = [10, 20, 30]
    requests_per_language = 10
    
    all_stats = []
    
    for concurrency in concurrency_levels:
        stats, results = run_test(concurrency, requests_per_language)
        all_stats.append((concurrency, stats))
        print_stats(stats)
    
    # Create comparison visualization
    plt.figure(figsize=(12, 8))
    
    plt.subplot(2, 2, 1)
    plt.title("Requests per Second vs Concurrency")
    plt.plot([s[0] for s in all_stats], [s[1]["requests_per_second"] for s in all_stats], "o-")
    plt.xlabel("Concurrency Level")
    plt.ylabel("Requests per Second")
    
    plt.subplot(2, 2, 2)
    plt.title("Success Rate vs Concurrency")
    plt.plot([s[0] for s in all_stats], [s[1]["success_rate"] for s in all_stats], "o-")
    plt.xlabel("Concurrency Level")
    plt.ylabel("Success Rate (%)")
    plt.ylim(0, 100)
    
    plt.subplot(2, 2, 3)
    plt.title("Average Submit Time vs Concurrency")
    for lang in PAYLOADS.keys():
        plt.plot([s[0] for s in all_stats], 
                 [s[1]["submit_times"][lang]["avg"] for s in all_stats], 
                 "o-", label=lang)
    plt.xlabel("Concurrency Level")
    plt.ylabel("Average Submit Time (s)")
    plt.legend()
    
    plt.subplot(2, 2, 4)
    plt.title("Average Wait Time vs Concurrency")
    for lang in PAYLOADS.keys():
        plt.plot([s[0] for s in all_stats], 
                 [s[1]["wait_times"][lang]["avg"] for s in all_stats], 
                 "o-", label=lang)
    plt.xlabel("Concurrency Level")
    plt.ylabel("Average Wait Time (s)")
    plt.legend()
    
    plt.tight_layout()
    plt.savefig("concurrency_comparison.png")
    print("Concurrency comparison saved to concurrency_comparison.png")
    
    # Plot detailed results for the highest concurrency test
    plot_results(all_stats[-1][1])

if __name__ == "__main__":
    main()