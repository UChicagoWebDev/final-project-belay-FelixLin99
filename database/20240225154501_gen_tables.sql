DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS reactions;
DROP TABLE IF EXISTS users_last_read;

CREATE TABLE channels (
    channel_id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_name VARCHAR(30)
);


CREATE TABLE users (
  username VARCHAR(30) PRIMARY KEY,
  password VARCHAR(30) NOT NULL,
  auth_key VARCHAR(30) NOT NULL
);


CREATE TABLE messages (
  message_id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel VARCHAR(30) NOT NULL,
  author VARCHAR(30) NOT NULL,
  body TEXT NOT NULL,
  replies_to VARCHAR(30),
  FOREIGN KEY(channel) REFERENCES channels(channel_name),
  FOREIGN KEY(author) REFERENCES users(username)
);


CREATE TABLE reactions (
    reaction_id INTEGER PRIMARY KEY,
    emoji TEXT NOT NULL,
    message_id INTEGER NOT NULL,
    username VARCHAR(30) NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(message_id),
    FOREIGN KEY (username) REFERENCES users(username)
);

CREATE TABLE users_last_read (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel VARCHAR(30) NOT NULL,
  username VARCHAR(30) NOT NULL,
  last_read INTEGER NOT NULL,
  FOREIGN KEY(channel) REFERENCES channels(channel_name),
  FOREIGN KEY(username) REFERENCES users(username),
  FOREIGN KEY(last_read) REFERENCES messages(message_id)
);
