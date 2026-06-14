import subprocess
import re

def find_notebook_id():
    # Run in debug mode to see raw API data
    # PythonIOEncoding=utf-8 to ensure subprocess.run captures it correctly
    env = {"PYTHONIOENCODING": "utf-8"}
    try:
        result = subprocess.run(
            ["nlm", "--debug", "notebook", "list"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env
        )
        # Search for something that looks like an ID
        # In nlm, IDs are often short strings if short-ids=true, or long hashes.
        # Let's look for the names too in the raw output.
        print("Searching in debug output...")
        output = result.stdout + result.stderr
        
        # Look for the user's notebook name "dạy học theo góc" (which may be escaped or in unicode)
        # and see if an ID is nearby.
        # Or look for any ID-like string in the vicinity of "dạy học theo góc"
        
        # Let's just print the whole debug output to a file and read it.
        with open("debug_output.txt", "w", encoding="utf-8") as f:
            f.write(output)
        
        print("Debug output saved to debug_output.txt")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    find_notebook_id()
