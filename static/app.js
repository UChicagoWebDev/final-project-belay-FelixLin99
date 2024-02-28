function MessageView(props) {
    let messageList = [];
    props.messages.forEach((message,index)=>{
        let decoded_msg = decodeURI(message.body);
        let urls = decoded_msg.match(/\bhttps?:\/\/\S+/gi);
        let imgList = [];
        let final_msg = decoded_msg;
        if (urls) {
            urls.forEach((url,url_index)=>{
                if (url.match(/^http[^\?]*.(jpg|jpeg|gif|png|tiff|bmp)(\?(.*))?$/gmi)) {
                    final_msg = final_msg.replace(url, '');
                    imgList.push(
                        <img key={url_index} src={url}></img>
                    )
                }
            });
        }
        if (message.num_replies > 0) {
                messageList.push(
                <div key={index}>
                    <p><auth id="author">{message.author}</auth> : <msg id="body">{final_msg}</msg></p>
                    {imgList}
                    <p><a id="reply_count" class="reply-box" onClick={()=>props.seeRepliesHandler(`/${props.channel}/${message.id}`)}> show {message.num_replies} replies </a></p>
                </div>
                )
            } else {
                messageList.push(
                <div key={index}>
                    <p><auth id="author">{message.author}</auth> : <msg id="body">{final_msg}</msg></p>
                    {imgList}
                    <p><a id="reply_count" class="reply-box" onClick={()=>props.seeRepliesHandler(`/${props.channel}/${message.id}`)}> reply </a></p>

                </div>
                )
            }

        })
    return (
        <div className="posted-messages">
            {messageList}
        </div>
    );
}


function PostMessage(props) {
    return (
        <div className="post-message">
            <form>
                <textarea id="new message" name="comment"></textarea>
                <button type="button" value="Post" onClick={props.postMessageHandler}>Post</button>
            </form>
        </div>
    )
}


function ReplyView(props) {
    let repliesList = [];
    let decoded_msg = decodeURI(props.message.msg_body);
    let urls = decoded_msg.match(/\bhttps?:\/\/\S+/gi);
    let msg_imgList = [];
    let final_msg = decoded_msg;
    if (urls) {
        urls.forEach((url,url_index)=>{
            if (url.match(/^http[^\?]*.(jpg|jpeg|gif|png|tiff|bmp)(\?(.*))?$/gmi)) {
                final_msg = final_msg.replace(url, '');
                msg_imgList.push(
                    <img key={url_index} src={url}></img>
                )
            }
        });
    }
    props.replies.forEach((reply,index)=>{
        let decoded_reply = decodeURI(reply.body);
        let urls = decoded_reply.match(/\bhttps?:\/\/\S+/gi);
        let imgList = [];
        let final_reply = decoded_reply;
        if (urls) {
            urls.forEach((url,url_index)=>{
                if (url.match(/^http[^\?]*.(jpg|jpeg|gif|png|tiff|bmp)(\?(.*))?$/gmi)) {
                    final_reply = final_reply.replace(url, '');
                    imgList.push(
                        <img key={url_index} src={url}></img>
                    )
                }
            });
        }
        repliesList.push(
            <p key={index}>
                <auth id="author">{reply.author}</auth> : <msg id="body">{final_reply}</msg>
                <p>{imgList}</p>
            </p>)
    })
    return (
        <div className="posted-messages">
            <p id="message-for-replies">
                <span className="material-icons md-12" onClick={()=>props.backButtonHandler(`/${props.channel}`)}>arrow_back</span>
                <auth id="author">{props.message.msg_author}</auth>  : {final_msg}
                <p>{msg_imgList}</p>
            </p>
            <br />
            <br />
            Replies:
            {repliesList}
        </div>
    );
}



class Belay extends React.Component {
    constructor(props) {
         super(props);
         this.state = {
            path: window.location.pathname,
            view: "home",
            isLoggedIn: true,
            username: "",
            channels: [],
            channel: "",
            messages: [],
            replies: [],
            messageId: "",
            message: {},
            unreadMessages: {},
             showChangeUsernameModal: false,
            showChangePasswordModal: false,
             showChannelPanel: true
        };

        window.addEventListener("popstate", (event)=>{
            let newPath;
            if (event.state) {
                newPath = event.state.path;
            } else {
                newPath = window.location.pathname;
            }
            this.changeUrl(newPath, false);
        });


        this.logout = this.logout.bind(this);
        this.toggleChangeUsernameModal = this.toggleChangeUsernameModal.bind(this);
        this.toggleChangePasswordModal = this.toggleChangePasswordModal.bind(this);
        this.toggleChannelPanelModal = this.toggleChannelPanelModal.bind(this);
        this.changeUsername = this.changeUsername.bind(this);
        this.changePassword = this.changePassword.bind(this);


    }

    componentDidMount() {
        this.changeUrl(this.state.path);
        this.checkLoggedIn();
        this.getChannels();
        this.getMessages(this.state.channel);
        this.getReplies(this.state.messageId);
    }


    newPathSetter = (newPath, pushToHistory=false) => {
        this.setState({path: newPath});
        if(pushToHistory) {
            window.history.pushState({path: newPath},"", newPath);
        }
    }

    changeUrl(url, push=true) {
        let urlPieces = url.split("/");
        let lenUrl = urlPieces.length;
        this.newPathSetter(url, push);
        if (lenUrl == 2) {
            let channel = urlPieces[lenUrl - 1];
            if (!channel) {
                //home view
                this.setState({
                    path: url,
                    view: "home"
                    });
            }
            else {
                //channel view
                this.setState({
                    path: url,
                    view: "channel",
                    channel: channel
                    });
            }
        }
        else if (lenUrl == 3 ) {
            //replies view
            let messageId = urlPieces[lenUrl - 1];
            let belay = this;
            fetch(`/api/get_msg_body/${messageId}`, {
                    method: 'GET',
                    headers: {
                    'Content-Type': 'application/json'
                    }
            }).then(function (response) {
                return response.json();
            }).then(function (msg_info) {
                belay.setState({
                path: url,
                view: "replies",
                channel: urlPieces[lenUrl - 2],
                messageId: messageId,
                message: msg_info.message
                });
            });
        }
    }

    checkLoggedIn() {
        const belay = this;
        let authKey = window.localStorage.getItem("shuhuilin_belay_auth_key");

        // check if logged in already
        if (authKey) {
                //logged in - get username
                fetch(`/api/check_loggedin`, {
                    method: 'GET',
                    headers: {
                    'Content-Type': 'application/json',
                    'auth-key': authKey,
                    }
                }).then(function (response) {
                    return response.json();
                }).then(function (user_info) {
                    if (user_info.username == "invalid auth key") {
                        window.localStorage.removeItem("shuhuilin_belay_auth_key");
                        belay.setState({isLoggedIn: false});
                    }
                    else {
                        belay.setState({username: user_info.username,
                                        isLoggedIn: true});
                    }
                })
        } else {
            belay.setState({isLoggedIn: false});
        }
    }

    createAccount() {
        const belay = this;
        let login_block = document.querySelector(".form-page");

        let usernameBox = document.getElementById("username");
        let username = usernameBox.value;
        usernameBox.value = "";

        let passwordBox = document.getElementById("password");
        let password = passwordBox.value;
        passwordBox.value = "";

        fetch(`/api/new_user/${username}`, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            'password': password,
            }
        }).then(function (response) {
            return response.json();
        }).then(function (user_info) {
            if (user_info.username_valid == false) {
                //username taken
                let error = document.createElement("error");
                error.append("Username already exists!");
                login_block.appendChild(error);
                setTimeout(function() {
                    login_block.removeChild(login_block.lastChild);
                }, 2000);
            } else {
                //can proceed - save info
                window.localStorage.setItem("shuhuilin_belay_auth_key", user_info.auth_key);
                belay.setState({
                    isLoggedIn: true,
                    username: username});
            }
        })
    }


    login() {
        const belay = this;
        let loginBlock = document.querySelector(".form-page");

        let usernameBox = document.getElementById("username");
        let username = usernameBox.value;
        usernameBox.value = "";

        let passwordBox = document.getElementById("password");
        let password = passwordBox.value;
        passwordBox.value = "";

        fetch(`/api/existing_user/${username}`, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            'password': password,
            }
        }).then(function (response) {
            return response.json();
        }).then(function (user_info) {
            if (user_info.username_found == false) {
                // username not found
                let error = document.createElement("error");
                error.append("Username NOT FOUND");
                loginBlock.appendChild(error);
                setTimeout(function() {
                    loginBlock.removeChild(loginBlock.lastChild);
                }, 2000);
            } else if (user_info.correct_pw == false) {
                // incorrect password
                let error = document.createElement("error");
                error.append("Password IS WRONG!");
                loginBlock.appendChild(error);
                setTimeout(function() {
                    loginBlock.removeChild(loginBlock.lastChild);
                }, 2000);
            } else {
                // can proceed - save info
                window.localStorage.setItem("shuhuilin_belay_auth_key", user_info.auth_key);
                belay.setState({
                    isLoggedIn: true,
                    username: username});
            }
        });
    }

    getChannels() {
        const belay = this;
        let authKey = window.localStorage.getItem("shuhuilin_belay_auth_key");
        fetch(`/api/get_channels`, {
                    method: 'GET',
                    headers: {
                    'Content-Type': 'application/json',
                    'auth-key': authKey,
                    }
        }).then(function (response) {
            return response.json();
        }).then(function (channel_info) {
            belay.setState({channels: channel_info.channels,
                            unreadMessages: channel_info.unread_messages});
        }).then(function () {
            belay.getChannels();
        });
    }

    triggerChannelForm() {
        this.setState({view: "new channel",
                       path: "/"})
        this.newPathSetter(`/`, true);
    }

    createChannel() {
        const belay = this;
        let channelBlock =  document.querySelector(".form-page");
        let channelBox = document.getElementById("newchannel");
        let ch_value = channelBox.value;
        let lower_ch_value= ch_value.toLowerCase();
        let hyphen_ch_value= lower_ch_value.replace(/ /g, '-');
        let newChannelName= hyphen_ch_value.replace(/[^\w-]+/g, '')
        channelBox.value = "";

        let auth_key = window.localStorage.getItem("shuhuilin_belay_auth_key");
        fetch(`/api/create/${newChannelName}`, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            'auth-key': auth_key
            }
        }).then(function (response) {
            return response.json();
        }).then(function (newchannel) {
            if (newchannel.name_valid == false) {
                let error = document.createElement("error");
                error.append("Channel Already Exists");
                channelBlock.appendChild(error);
                setTimeout(function() {
                    channelBlock.removeChild(channelBlock.lastChild);
                }, 2000);
            }
            else {
                //update list of channels in state
                let curChannels = belay.state.channels.slice();
                curChannels.push(newChannelName);
                belay.setState({
                    path:`/${newChannelName}`,
                    channels: curChannels,
                    view: "channel",
                    channel: newChannelName
                });
                belay.newPathSetter(`/${newChannelName}`, true);
            }
        });
    }

    getMessages(channel){
        const belay = this;
        let authKey = window.localStorage.getItem("shuhuilin_belay_auth_key");
        if (this.state.view == "channel" && channel && this.state.isLoggedIn) {
            //make sure we are on channel view, have a state channel set, and are logged in
            fetch(`/api/${channel}/get_messages`, {
                    method: 'POST',
                    headers: {
                    'Content-Type': 'application/json',
                    'auth-key': authKey
                    }
            }).then(function (response) {
                return response.json();
            }).then(function (msg_info) {
                //only update if messages have changed
                if (JSON.stringify(msg_info.messages) != JSON.stringify(belay.state.messages)) {
                    belay.setState({messages: msg_info.messages});
                }
            }).then(function () {
                belay.getMessages(belay.state.channel);
            });
        } else {
            setTimeout(function() {
                belay.getMessages(belay.state.channel);
            }, 2);
        }
    }

    postNewMessage = (channel) => {
        const belay = this;
        let authKey = window.localStorage.getItem("shuhuilin_belay_auth_key");

        let message = document.getElementById("new message").value;
        let encoded_message = encodeURI(message);

        fetch(`/api/${channel}/post_message`, {
                    method: 'POST',
                    headers: {
                    'Content-Type': 'application/json',
                    'auth-key': authKey,
                    'body': encoded_message,
                    'author': belay.state.username
                    }
            }).then(function (){
            // update list of messages in state
            document.getElementById("new message").value = "";
            let curMessages = belay.state.messages.slice();
            curMessages.push({"body": message, "author": belay.state.username});
            belay.setState({messages: curMessages});
        })
    }

    getReplies(messageId){
        const belay = this;
        let authKey = window.localStorage.getItem("shuhuilin_belay_auth_key");

        if (messageId) {
            //only fetch if in message reply view (i.e. have messageId)
            fetch(`/api/get_replies/${messageId}`, {
                    method: 'GET',
                    headers: {
                    'Content-Type': 'application/json',
                    'auth-key': authKey
                    }
            }).then(function (response) {
                return response.json();
            }).then(function (reply_info) {
                // only update replies if they have changed
                if (JSON.stringify(reply_info.replies) != JSON.stringify(belay.state.replies)) {
                    belay.setState({replies: reply_info.replies});
                }
            }).then(function () {
                belay.getReplies(belay.state.messageId);
            });
        } else {
            setTimeout(function() {
                belay.getReplies(belay.state.messageId);
            }, 2);
        }
    }

    postNewReply = (channel, messageId) => {
        const belay = this;
        let authKey = window.localStorage.getItem("shuhuilin_belay_auth_key");

        let reply = document.getElementById("new message").value;
        let encoded_reply = encodeURI(reply);

        fetch(`/api/${channel}/post_reply`, {
                    method: 'POST',
                    headers: {
                    'Content-Type': 'application/json',
                    'auth-key': authKey,
                    'body': encoded_reply,
                    'author': belay.state.username,
                    'msg-id': messageId
                    }
            }).then(function (){
            // update list of replies in state
            document.getElementById("new message").value = "";
            let curReplies = belay.state.replies.slice();
            curReplies.push({"body": reply, "author": belay.state.username});
            belay.setState({replies: curReplies});
        })
    }

    logout() {
        window.localStorage.removeItem("shuhuilin_belay_auth_key");
        this.setState({isLoggedIn: false, username: ""});
    }

    toggleChangeUsernameModal() {
        this.setState(prevState => ({
            showChangeUsernameModal: !prevState.showChangeUsernameModal
        }));
    }

    toggleChangePasswordModal() {
        this.setState(prevState => ({
            showChangePasswordModal: !prevState.showChangePasswordModal
        }));
    }

    toggleChannelPanelModal() {
        this.setState(prevState => ({
            showChannelPanel: !prevState.showChannelPanel
        }));
    }

    changeUsername(newUsername, password) {
        const authKey = window.localStorage.getItem("shuhuilin_belay_auth_key");
        fetch(`/api/change_username`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'auth-key': authKey,
                'password': password // This should be obtained from the user input
            },
            body: JSON.stringify({new_username: newUsername})
        }).then(response => response.json())
        .then(data => {
            if(data.success) {
                this.setState({username: newUsername});
                alert('Username successfully changed.');
            } else {
                alert('Error changing username: ' + data.error);
            }
        });
    }

    handleUsernameChangeSubmit(event) {
        event.preventDefault();
        const newUsername = event.target.newUsername.value;
        const password = event.target.password.value;
        this.changeUsername(newUsername, password);
    }

    handlePasswordChangeSubmit(event) {
        event.preventDefault();
        const currentPassword = event.target.currentPassword.value;
        const newPassword = event.target.newPassword.value;
        this.changePassword(currentPassword, newPassword);
    }

    changePassword(currentPassword, newPassword) {
        const authKey = window.localStorage.getItem("shuhuilin_belay_auth_key");
        fetch(`/api/change_password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'auth-key': authKey,
                'current-password': currentPassword // This should be obtained from the user input
            },
            body: JSON.stringify({new_password: newPassword})
        }).then(response => response.json())
        .then(data => {
            if(data.success) {
                alert('Password successfully changed.');
            } else {
                alert('Error changing password: ' + data.error);
            }
        });
    }



    render() {
        console.log("state at render belay:", this.state);

        // need to login
        if (!this.state.isLoggedIn){
            return (
            <LogInBox
                loginHandler={()=>this.login()}
                newUserHandler = {()=>this.createAccount()}/>

            );
        }
        //home view
       if (this.state.view == "home") {

           return (
               <div>
                   <div id="buttons-container">
                        <button className="action-button" onClick={this.logout}>Log Out</button>
                        <button className="action-button" onClick={this.toggleChangeUsernameModal}>Change Username</button>
                        <button className="action-button" onClick={this.toggleChangePasswordModal}>Change Password</button>

                        {this.state.showChangeUsernameModal && (
                            <form onSubmit={this.handleUsernameChangeSubmit.bind(this)}>
                                <label>
                                    New Username:
                                    <input type="text" name="newUsername" required />
                                </label>
                                <label>
                                    Current Password:
                                    <input type="password" name="password" required />
                                </label>
                                <button type="submit">Change Username</button>
                            </form>
                        )}

                        {this.state.showChangePasswordModal && (
                            <form onSubmit={this.handlePasswordChangeSubmit.bind(this)}>
                                <label>
                                    Current Password:
                                    <input type="password" name="currentPassword" required />
                                </label>
                                <label>
                                    New Password:
                                    <input type="password" name="newPassword" required />
                                </label>
                                <button type="submit">Change Password</button>
                            </form>
                        )}
                    </div>
                   <button onClick={this.toggleChannelPanelModal}>show/hide channels</button>
                   <div className="channel-view">
                       <ChannelMenu
                           showChannel = {this.state.showChannelPanel}
                            channel = {this.state.channel}
                            channels = {this.state.channels}
                            unreadMessages = {this.state.unreadMessages}
                            clickChannelHandler = {(i)=>this.changeUrl(i)}
                            triggerFormHandler = {()=>this.triggerChannelForm()}/>
                        <div className="message-view">
                        </div>
                   </div>
               </div>
            );
        }
        //channel view
        else if (this.state.view == "channel"){
            return (
                <div>
                    <button onClick={this.toggleChannelPanelModal}>show/hide channels</button>
                <div className="channel-view">
                <ChannelMenu
                    showChannel = {this.state.showChannelPanel}
                    channel = {this.state.channel}
                    channels = {this.state.channels}
                    unreadMessages = {this.state.unreadMessages}
                    clickChannelHandler = {(i)=>this.changeUrl(i)}
                    triggerFormHandler = {()=>this.triggerChannelForm()}/>
                <div className="message-view">
                <MessageView
                    channel = {this.state.channel}
                    messages = {this.state.messages}
                    seeRepliesHandler = {(i)=> this.changeUrl(i)}/>
                <PostMessage
                    postMessageHandler = {()=>this.postNewMessage(this.state.channel)}
                    unReadHandler = {()=>this.updateUnRead(this.state.channel)}/>
                </div>
                </div>
                </div>
            );
        }
        //new channel form view
        else if (this.state.view == "new channel") {
            return (
                <ChannelForm
                    createChannelHandler={()=>this.createChannel()}/>
            )
        }
        //reply view
        else if (this.state.view == "replies") {
            return(
                <div>
                    <button onClick={this.toggleChannelPanelModal}>show/hide channels</button>
                <div className="channel-view">
                <ChannelMenu
                    showChannel = {this.state.showChannelPanel}
                    channel = {this.state.channel}
                    channels = {this.state.channels}
                    unreadMessages = {this.state.unreadMessages}
                    clickChannelHandler = {(i)=>this.changeUrl(i)}
                    triggerFormHandler = {()=>this.triggerChannelForm()}/>
                <div className="message-view">
                <ReplyView
                    channel = {this.state.channel}
                    //messageId = {this.state.messageId}
                    message = {this.state.message}
                    replies = {this.state.replies}
                    backButtonHandler = {(i)=> this.changeUrl(i)}/>
                <PostMessage
                    postMessageHandler = {()=>this.postNewReply(this.state.channel, this.state.messageId)} />
                </div>
                </div>
                </div>
            );
        }

        else {
            return(
                <div> Error </div>
            );
        }
    }
}


function LogInBox(props) {
    return (
        <div className="form-page">
            <h3>Please enter a username and password</h3>
            <p className="username"> username: <input id="username"></input> </p>
            <p className="password"> password: <input id="password"></input></p>
            <div className="login-buttons">
                <button className="login" onClick={props.loginHandler}>Login</button>
                <button className="create-user" onClick={props.newUserHandler}>Create A New Account</button>
            </div>
        </div>
    );
}


function ChannelForm(props) {
    return (
        <div className="form-page">
            <p><h3>Create a channel</h3></p>
            <p>Channels are where conversations happen around a topic. Use a name that is easy to find and understand.</p>
            <p className="newchannel"> Name: <input id="newchannel"></input> </p>
            <button className="newchannel-button" onClick={props.createChannelHandler}>Submit</button>
        </div>
    );
}


function ChannelMenu(props) {
    if (props.showChannel == false) {
        return (
        <div className="channel-menu"></div>
        );
    }
    let buttonList = [];
    props.channels.forEach((name,index)=>{
        if (name == props.channel) {
            buttonList.push(<p key={index}><a id="selected" onClick={()=>props.clickChannelHandler(`/${name}`)}># {name}</a></p>)
        }
        else {
            if (props.unreadMessages[`${name}`] > 0) {
                buttonList.push(<p key={index}><a onClick={()=>props.clickChannelHandler(`/${name}`)}># {name} ({props.unreadMessages[`${name}`]})</a></p>)
            } else {
                buttonList.push(<p key={index}><a onClick={()=>props.clickChannelHandler(`/${name}`)}># {name}</a></p>)
            }
        }
    })
    return (
        <div className="channel-menu">
                <h2>▼ Channels</h2>
                <div className="all-buttons">
                    {buttonList}
                    <button id = "final_button" onClick={props.triggerFormHandler}>
                        + Add A New Channel
                    </button>
                </div>
        </div>
    );
}




ReactDOM.render(
    <Belay />,
    document.getElementById('root')
);
