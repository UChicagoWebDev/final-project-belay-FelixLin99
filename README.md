# Final Project: Belay (a Slack clone)

## Get started:
1. Enter the project directory
   
2. Install packages: 
   ```
   pip3 install -r requirements.txt
   ```
   or
   ```
   pip install -r requirements.txt
   ```
   
3.  Generate sqlite3 tables: 
    ```
    sqlite3 database/belay.db < database/20240225154501_gen_tables.sql
    ```

4. Launch the server: 
    ```
    python app.py
    ```
   or
    ```
    python3 app.py
    ```