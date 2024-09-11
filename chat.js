import { Widget } from './widget.js'

export class User extends Widget {
  usernameRenderer (value) { return value.split(" ").map(w => w[0]).join("") }
  set username (value) { this.value.username = value }
  get username () { return this.value.username }
}

export class Myself extends User {
  renderer (tag) {
    const bg = tag.querySelector(":scope > div");
    bg.classList.remove("bg-neutral", "text-neutral-content");
    bg.classList.add("bg-primary", "text-primary-content");
    return tag;
  }
}

export class Message extends Widget {
  timestampRenderer (value) {
    const todaysTimestampFormat = { hour: 'numeric', minute: 'numeric' };
    const pastTimestampFormat = {
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'
    };
    const todaysDate = new Date();
    const date = new Date(value);
    const format = todaysDate.toDateString() === date.toDateString() ? todaysTimestampFormat : pastTimestampFormat;
    return new Intl.DateTimeFormat(undefined, format).format(date);
  }

  renderer (tag) {
    tag.querySelector("time").setAttribute("datetime", this.timestamp.getTime());
    return tag;
  }

  set id (value) { this.value.id = value }
  get id () { return this.value.id }
  set timestamp (value) { this.value.timestamp = value }
  get timestamp () { return this.value.timestamp }
  set msg (value) { this.value.msg = value }
  get msg () { return this.value.msg }
}

export class MyMessage extends Message {
  renderer (tag) {
    super.renderer(tag);
    tag.classList.remove("chat-start");
    tag.classList.add("chat-end");
    tag.querySelector(".chat-bubble").classList.add("chat-bubble-primary");
    return tag;
  }
}

export class SysMessage extends Message {
  set level (value) { this.value.level = value }
  get level () { return this.value.level }

  renderer (tag) {
    super.renderer(tag);
    tag.querySelector(".chat-header").remove();
    tag.querySelector(".chat-footer").remove();
    tag.classList.remove("chat-start");
    tag.classList.add("chat-end");
    const levels = {
      info: "chat-bubble-info",
      success: "chat-bubble-success",
      warning: "chat-bubble-warning",
      error: "chat-bubble-error"
    }
    tag.querySelector(".chat-bubble").classList.add(levels[this.value.level]);
    return tag;
  }
}

export class Chat extends Widget {
  #url;
  #username;
  #token;
  #tenant;
  #room;
  #classSelector;
  #client;
  #intersection;
  #shouldRefreshMsgs = false;

  constructor (value, url, username, token, tenant, room) {
    const classSelector = (name, obj) => {
      if (name === 'msgs') {
        if (obj.username === username) return MyMessage;
        else if (Object.keys(obj).includes("level")) return SysMessage;
        else return Message;
      } else if (name === "users") {
        return obj.username === username ? Myself : User;
      }
    }
    super(value, classSelector);

    this.#setupSysMessage("Connecting...");

    this.#url = url;
    this.#username = username;
    this.#token = token;
    this.#tenant = tenant;
    this.#room = room;
    this.#classSelector = classSelector;
    this.#setupWSClient();
  }

  #setupSysMessage (msg, level = "info") {
    const msgObj = new SysMessage({
      username: "chat-system", msg, level, timestamp: Date.now()
    }, undefined, this.props.msgs);
    this.value.msgs.push(msgObj);
  }

  #setupWSClient () {
    this.#client = io(this.#url, { auth: { token: this.#token, tenant: this.#tenant } });

    this.#client.on("connect_error", err => {
      if (err.message === "Unauthorized") this.#setupUnauthorized(err);
      else console.error(err);
    });

    this.#client.on("connect", () => {
      this.#setupUI();
      this.#client.on("Joined", ({ users, msgs }) => {
        this.value.users.push(...users.map(o => {
          const klass = this.#classSelector("users", o);
          return new klass(o, undefined, this.props.users);
        }));

        this.value.msgs.push(...msgs.map(o => {
          const klass = this.#classSelector("msgs", o);
          return new klass(o, undefined, this.props.msgs);
        }));

        this.tmpl.querySelector("[data-prop=msgs]").dataset.reversed = "";
        this.#setupIntersection();
      });
      this.#client.on("NewUser", user => {
        const klass = this.#classSelector("users", user);
        this.value.users.push(new klass(user, undefined, this.props.users));
      });
      this.#client.on("message", msg => {
        const klass = this.#classSelector("msgs", msg);
        this.value.msgs.unshift(new klass(msg, undefined, this.props.msgs));
      });
      this.#client.on("next_messages", msgs => {
        if (msgs.length) {
          const msgsTag = this.tmpl.querySelector("[data-prop=msgs]");
          delete msgsTag.dataset.reversed;

          this.value.msgs.push(...msgs.map(o => {
            const klass = this.#classSelector("msgs", o);
            return new klass(o, undefined, this.props.msgs);
          }));

          msgsTag.dataset.reversed = "";
          this.#setupIntersection();
        }
      });
      this.#client.on("UserDisconnected", users => {
        const currentUsers = users.map(u => u.id);
        for (const idx in this.value.users) {
          if (!currentUsers.includes(this.value.users[idx].value.id)) {
            this.value.users.splice(idx, 1);
            break;
          }
        }
      });

      this.#client.emit("JoinRoom", {
        username: this.#username, room: `${ this.#tenant }:${ this.#room }`
      });
    });
  }

  #setupUnauthorized (err) {
    const connectingIdx = this.value.msgs.findIndex(m => m.msg === "Connecting...");
    this.value.msgs.splice(connectingIdx, 1);

    this.#setupSysMessage(err.message, "error");
  }

  #setupUI () {
    this.tmpl.querySelector("form").addEventListener("submit", e => {
      e.preventDefault();

      const form = new FormData(e.target);
      this.#client.emit("message", form.get("msg"));
      e.target.msg.value = "";
      e.target.msg.focus();
    });
    this.tmpl.querySelector("form > input").disabled = false;
    this.tmpl.querySelector("form > button").disabled = false;
    const connectingIdx = this.value.msgs.findIndex(m => m.msg === "Connecting...");
    this.value.msgs.splice(connectingIdx, 1);
    const msgs = this.tmpl.querySelector("[data-prop=msgs]");
    msgs.style.height = `${ msgs.offsetHeight}px`;
  }

  #setupIntersection () {
    const msgs = this.tmpl.querySelector("[data-prop=msgs]");
    const lastMsg = msgs.querySelector(":scope > .chat:last-child");

    this.#intersection = new IntersectionObserver(this.#intersected, { root: msgs, threshold: 0 });
    this.#intersection.wsClient = this.#client;
    this.#intersection.shouldRefreshMsgs = this.#shouldRefreshMsgs;
    this.#intersection.observe(lastMsg);
  }

  #intersected (entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting && !this.shouldRefreshMsgs) this.shouldRefreshMsgs = true;
      else if (entry.isIntersecting && this.shouldRefreshMsgs) {
        this.wsClient.emit("more_messages", [ parseInt(entry.target.querySelector("time").getAttribute("datetime")) ])
        this.unobserve(entry.target);
        this.shouldRefreshMsgs = false;
      } else {
        this.unobserve(entry.target);
        this.shouldRefreshMsgs = false;
      }
    });
  }
}