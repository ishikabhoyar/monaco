import os
import aiohttp
import asyncio
from datetime import datetime, timedelta

# Base URL template
BASE_URL = "https://bhuvan-app3.nrsc.gov.in/isroeodatadownloadutility/tiledownloadnew_cfr_new.php?f=nices_ssm2_{}_{}.zip&se=NICES&u=arnabafk"

# Directory to save files
SAVE_DIR = "data"
os.makedirs(SAVE_DIR, exist_ok=True)

async def download_file(session, file_url, file_path):
    """Download a file asynchronously."""
    print(f"Downloading {file_url}...")
    try:
        async with session.get(file_url) as response:
            if response.status == 200:
                with open(file_path, 'wb') as file:
                    while chunk := await response.content.read(1024):
                        file.write(chunk)
                print(f"Downloaded: {file_path}")
            else:
                print(f"Failed to download: {file_path}, Status Code: {response.status}")
    except Exception as e:
        print(f"Error downloading {file_url}: {e}")

async def fetch_data_for_year(session, year):
    """Fetch and download data for a given year."""
    year_dir = os.path.join(SAVE_DIR, str(year))
    os.makedirs(year_dir, exist_ok=True)
    
    start_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31)
    delta = timedelta(days=2)
    tasks = []
    
    date = start_date
    while date <= end_date:
        date_str = date.strftime("%Y%m%d")
        file_url = BASE_URL.format(date_str, "NICES")
        file_name = f"nices_ssm2_{date_str}.zip"
        file_path = os.path.join(year_dir, file_name)
        
        tasks.append(download_file(session, file_url, file_path))
        date += delta
    
    await asyncio.gather(*tasks)

async def main():
    """Main function to download data for multiple years."""
    async with aiohttp.ClientSession() as session:
        await asyncio.gather(*(fetch_data_for_year(session, year) for year in range(2002, 2025)))

if __name__ == "__main__":
    asyncio.run(main())
