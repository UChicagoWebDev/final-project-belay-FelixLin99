# -*- coding:utf-8 -*-
# @Time : 2024/2/27 23:08
# @Author: ShuhuiLin
# @File : app.py

import time
import sqlite3
import bcrypt
from flask import Flask, request, jsonify
from uuid import uuid1

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0


@app.route('/api/change_username', methods=['POST'])
def change_username():
    auth_key = request.headers['auth-key']
    new_username = request.json['new_username']
    password = request.headers['password']
    username = fetch_username(auth_key)

    if not username:
        return jsonify({"error": "Invalid auth key"}), 403

    # Verify password
    connection = sqlite3.connect("database/belay.db")
    cursor = connection.cursor()
    cursor.execute("SELECT password FROM users WHERE username == ?", (username,))
    user = cursor.fetchone()
    if user and bcrypt.checkpw(password.encode('utf-8'), user[0]):
        # Update username
        cursor.execute("UPDATE users SET username = ? WHERE auth_key == ?", (new_username, auth_key))
        connection.commit()
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Incorrect password"}), 403


@app.route('/api/change_password', methods=['POST'])
def change_password():
    auth_key = request.headers['auth-key']
    current_password = request.headers['current-password']
    new_password = request.json['new_password']
    username = fetch_username(auth_key)

    if not username:
        return jsonify({"error": "Invalid auth key"}), 403

    # Verify current password
    connection = sqlite3.connect("database/belay.db")
    cursor = connection.cursor()
    cursor.execute("SELECT password FROM users WHERE username == ?", (username,))
    user = cursor.fetchone()
    if user and bcrypt.checkpw(current_password.encode('utf-8'), user[0]):
        # Update password
        hashed_pw = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        cursor.execute("UPDATE users SET password = ? WHERE auth_key == ?", (hashed_pw, auth_key))
        connection.commit()
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Incorrect current password"}), 403


@app.route('/api/new_user/<username>', methods=['POST'])
def create_user(username):
    new_auth_key = generate_auth_key()
    user_password = request.headers.get('password')
    encrypted_password = hash_password(user_password)

    with sqlite3.connect("database/belay.db") as db_conn:
        db_cur = db_conn.cursor()
        try:
            db_cur.execute("INSERT INTO users (username, password, auth_key) VALUES (?, ?, ?)",
                           (username, encrypted_password, new_auth_key))
        except sqlite3.IntegrityError:
            return jsonify({"username_valid": False}), 400

        db_cur.execute("INSERT INTO users_last_read (channel, username, last_read) SELECT channel_name, ?, 0 FROM channels",
                       (username,))
        db_conn.commit()

    return jsonify({"username_valid": True, "auth_key": new_auth_key})


@app.route('/api/existing_user/<username>', methods=['POST'])
def authenticate_user(username):
    user_password = request.headers.get('password')

    with sqlite3.connect("database/belay.db") as db_conn:
        db_cur = db_conn.cursor()
        db_cur.execute("SELECT * FROM users WHERE username = ?", (username,))
        user_record = db_cur.fetchone()

    if not user_record:
        return jsonify({"username_found": False}), 404

    _, stored_password, user_auth_key = user_record

    if not bcrypt.checkpw(user_password.encode('utf-8'), stored_password):
        return jsonify({"username_found": True, "correct_pw": False}), 401

    return jsonify({"username_found": True, "correct_pw": True, "auth_key": user_auth_key})


@app.route('/api/check_loggedin', methods=['GET'])
def user_status():
    key = request.headers.get('auth-key')
    user = fetch_username(key)

    if user:
        return jsonify({"loggedin": True, "username": user})
    else:
        return jsonify({"loggedin": False, "error": "Invalid auth key"}), 403


@app.route('/', defaults={'channel': None, 'msg_id': None})
@app.route('/<channel>', defaults={'msg_id': None})
@app.route('/<channel>/<int:msg_id>')
def home(channel, msg_id):
    with sqlite3.connect("database/belay.db") as conn:
        cur = conn.cursor()
        if channel:
            cur.execute("SELECT COUNT(*) FROM channels WHERE channel_name = ?", (channel,))
            if cur.fetchone()[0] == 0:
                error_info = {'code': 404, 'status': 'error', "message": f"{channel} is not a recognized channel"}
                return jsonify(error_info), 404
        if msg_id:
            cur.execute("SELECT COUNT(*) FROM messages WHERE replies_to IS NULL AND message_id = ?", (msg_id,))
            if cur.fetchone()[0] == 0:
                error_info = {'code': 405, 'status': 'error', "message": f"Message ID {msg_id} cannot be found"}
                return jsonify(error_info), 405

    return app.send_static_file('index.html')


@app.route('/api/get_channels', methods=['GET'])
def list_channels():
    user_auth_key = request.headers.get('auth-key')
    user_name = fetch_username(user_auth_key)

    # Delay to simulate database processing time
    time.sleep(0.5)
    with sqlite3.connect("database/belay.db") as db:
        cur = db.cursor()
        # Retrieve list of channels
        cur.execute("SELECT channel_name FROM channels")
        channel_list = [channel[0] for channel in cur.fetchall()]

    # query database for unread messages
    cur.execute(
        """
        SELECT
            t.channel,
            CASE WHEN message_id = 0 THEN 0 ELSE COUNT(*) END AS num_read,
            t.last_read
        FROM (
            SELECT
                CASE WHEN m.message_id IS NULL THEN 0 ELSE m.message_id END AS message_id,
                ulr.channel,
                ulr.username,
                ulr.last_read
            FROM users_last_read ulr
            LEFT JOIN messages AS m ON ulr.channel = m.channel
            WHERE m.replies_to IS NULL AND ulr.username = ?
        ) AS t
        WHERE t.message_id > t.last_read
        GROUP BY t.channel
        """,
        (user_name,))
    unread_counts = {row[0]: row[1] for row in cur.fetchall()}
    return jsonify({"channels": channel_list, "unread_messages": unread_counts})


@app.route('/api/<channel>/get_messages', methods=['POST'])
def channel_messages(channel):
    auth_key = request.headers.get('auth-key')

    # Validate authentication key
    if not is_auth_key_valid(auth_key):
        return jsonify({"error": "Invalid authentication key"}), 403

    # Delay to simulate database processing time
    time.sleep(0.5)
    with sqlite3.connect("database/belay.db") as db:
        cur = db.cursor()
        # Retrieve messages and count replies for each message in the channel
        cur.execute("""
        SELECT
            m.message_id,
            m.author,
            m.body,
            r.replies_to,
            COUNT(*)
        FROM (
            SELECT * FROM messages WHERE replies_to IS NULL
        ) AS m
        LEFT JOIN (
            SELECT * FROM messages WHERE replies_to IS NOT NULL
        ) AS r 
        ON m.message_id = r.replies_to
        WHERE
            m.channel = ?
        GROUP BY
            m.message_id
        """,
        (channel,))
        messages_data = cur.fetchall()

        # Update user's last read message if messages exist
        if messages_data:
            user_name = fetch_username(auth_key)
            last_message_id = messages_data[-1][0]
            cur.execute("UPDATE users_last_read SET last_read = ? WHERE channel = ? AND username = ?", (last_message_id, channel, user_name))
            db.commit()

    messages = [{"id": msg[0], "author": msg[1], "body": msg[2], "num_replies": msg[4] if msg[3] else 0} for msg in messages_data]

    return jsonify({"messages": messages})


@app.route('/api/get_msg_body/<int:msg_id>', methods=['GET'])
def get_message_body(msg_id):
    with sqlite3.connect("database/belay.db") as db:
        cur = db.cursor()
        cur.execute("SELECT author, body FROM messages WHERE message_id = ?", (msg_id,))
        result = cur.fetchone()
    if result:
        author, body = result
        message_details = {"msg_author": author, "msg_body": body}
        return jsonify({"message": message_details})
    else:
        return jsonify({"error": "Message not found"}), 404

@app.route('/api/get_replies/<int:msg_id>', methods=['GET'])
def retrieve_replies(msg_id):
    time.sleep(0.5)  # Simulating network delay
    with sqlite3.connect("database/belay.db") as db:
        cur = db.cursor()
        cur.execute("SELECT author, body FROM messages WHERE replies_to = ?", (msg_id,))
        replies = [{"author": author, "body": body} for author, body in cur.fetchall()]

    return jsonify({"replies": replies})


@app.route('/api/<channel>/post_message', methods=['POST'])
def submit_message(channel):
    user_auth_key = request.headers.get('auth-key')
    if not is_auth_key_valid(user_auth_key):
        return jsonify({"error": "Unauthorized access"}), 403

    message_body = request.headers.get('body')
    author_name = request.headers.get('author')
    with sqlite3.connect("database/belay.db") as db:
        cur = db.cursor()
        cur.execute("INSERT INTO messages (author, body, channel) VALUES (?, ?, ?)",
                    (author_name, message_body, channel))
        db.commit()
    return jsonify({"posted_message": True})


@app.route('/api/<channel>/post_reply', methods=['POST'])
def post_reply(channel):
    auth_key = request.headers['auth-key']
    if is_auth_key_valid(auth_key):
        body = request.headers['body']
        username = request.headers['author']
        msg_id = request.headers['msg-id']

        # add new reply to replies table
        connection = sqlite3.connect("database/belay.db")
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO messages (author, body, channel, replies_to) VALUES (?,?,?,?)",
            (username, body, channel, msg_id))
        connection.commit()
        return jsonify({"posted_reply": True})
    return 403


@app.route('/api/create/<channel_name>', methods=['POST'])
def create_channel(channel_name):
    auth_key = request.headers['auth-key']
    if is_auth_key_valid(auth_key):
        connection = sqlite3.connect("database/belay.db")
        cursor = connection.cursor()
        try:
            cursor.execute(
                "INSERT INTO channels (channel_name) VALUES (?)",
                (channel_name,))
        except sqlite3.IntegrityError as e:
            print(f"in integriy error: {e}")
            return jsonify({"name_valid": False})
        cursor.execute("INSERT INTO users_last_read (channel, username, last_read) " +
                       "SELECT ?, username, 0 from users",
                       (channel_name,))
        connection.commit()
        return jsonify({"name_valid": True})
    return 403


# helpers
def generate_auth_key():
    return str(uuid1())

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def is_auth_key_valid(key):
    if key is None:
        return False
    with sqlite3.connect("database/belay.db") as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM users WHERE auth_key = ?", (key,))
        result = cur.fetchone()[0]
    return result != 0

def fetch_username(key):
    with sqlite3.connect("database/belay.db") as conn:
        cur = conn.cursor()
        cur.execute("SELECT username FROM users WHERE auth_key = ?", (key,))
        user_data = cur.fetchone()
    return user_data[0] if user_data else None

app.run(debug=True)
