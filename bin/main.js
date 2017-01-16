#! /usr/bin/env node

'use strict'

const fs = require('fs');
const path = require('path');
const Gopher = require('gopher-lib');
const colorMap = {
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	default: '\x1b[39m',
};

function col(c, t) {
	return colorMap[c] + t + colorMap.default;
}


class History {
	constructor() {
		this.curIdx = 0;
		this.cur = null;
		this._blockMerge = false;
		this.hist = [];
	}

	next() {
		if (this.curIdx + 1 < this.hist.length) {
			this.curIdx++;
			this.setHist();
		} else {
			console.log(col('yellow', 'You are at the end.'));
			screen.showPrompt();
		}
	}

	prev() {
		if (this.hist.length && this.curIdx > 0) {
			this.curIdx--;
			this.setHist();
		} else {
			console.log(col('yellow', 'You are at the beginning.'));
			screen.showPrompt();
		}
	}

	setHist(itemNum) {

		if (itemNum === 0 || itemNum) {
			if (itemNum > -1 && itemNum < this.hist.length) {
				this.curIdx = itemNum;
			} else {
				throw new Error();
			}
		}

		this.cur = this.hist[this.curIdx];
		this._blockMerge = true;
		fetch(this.cur);
	}

	list() {
		console.log();
		console.log(col('yellow', 'History'));
		this.hist.forEach((item, i) => {
			console.log(((i == this.curIdx) ? '-> ' : '   ') + ' ' + ((i < 10) ? ' ' : '') + col('yellow', i) + ' ' + decodeURI(item.toShortURI()));
		});

		screen.showPrompt();
	}

	merge(res) {
		if (!this._blockMerge) {


			// Erase everything in front of current position
			this.hist.splice(this.curIdx + 1);

			if (this.cur != res) {
				this.cur = res;
				this.curIdx = this.hist.push(res) - 1;
			}
		} else {
			this._blockMerge = false;
		}
	}

}

var height = process.stdout.rows;
var width = process.stdout.columns;

const slack = 6;
var client = new Gopher.Client();
//Any arguments?
var go = process.argv[2] || 'gopher://dusted.dk:70/#DusteDs Home in Cyberspace';

go = new Gopher.Resource(go);

process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
	doCmd(input.replace(/\r/, '').replace(/\n/, ''));
});

console.log();
console.log(col('yellow', 'gopher-client copyleft (WTFPL) 2017 - DusteD'));
console.log('Press ? and enter for help.');

if (width && height) {
	process.stdout.on('resize', () => {
		height = process.stdout.rows;
		width = process.stdout.columns;
	});
} else {
	width = 80;
	height = 24;
	console.log(col('red', 'Could not get terminal size, fallback to ' + width + 'x' + height + '.'));
}


var items = [];

var history = new History();

function typeToStr(t) {
	switch (t) {
		case '0':
			return ' TXT';
			break;
		case '1':
			return ' DIR';
			break;
		case '2':
			return ' CSO';
			break;
		case '3':
			return ' ERR';
			break;
		case '4':
			return 'HXBN';
			break;
		case '5':
			return ' DOS';
			break;
		case '6':
			return 'UENC';
			break;
		case '7':
			return 'SRCH';
			break;
		case '8':
			return ' TEL';
			break;
		case '9':
			return ' BIN';
			break;
		case 'I':
			return ' IMG';
			break;
		case 'g':
			return ' GIF';
			break;
		case 't':
			return ' TN3';
			break;
		case 'h':
			return 'HTML';
			break;
		case 'M':
			return 'MAIL';
			break;
		default:
			return '?' + t + '?';
			break;
	}
}

var cursor = {
	up: function (numLines) {
		return '\r\x1b[' + numLines + 'A';
	},
	down: function (numLines) {
		return '\r\x1b[' + numLines + 'B';
	},
	right: function (numChars) {
		return '\x1b[' + numChars + 'C';
	},
	left: function (numChars) {
		return '\x1b[' + numChars + 'D';
	},
	clearFromCursor: function () {
		return '\x1b[K';
	}
};

class Screen {
	constructor() {
		this.clear();
	}
	write(txt) {
		this.lines.push(txt);
		this.total++;
	}
	restart() {
		this.cur = 0;
		this.print();
	}
	clear() {
		this.lines = [];
		this.cur = 0;
		this.total = 0;
		this.msgLen = 0;
	}
	print() {
		var i;
		var numLines = height - slack;
		if (this.cur !== 0 && this.cur !== this.total) {
			console.log(cursor.up(1) + cursor.right(this.msgLen + 2) + col('green', '{Continue}'));
		}
		var realLines = 0;
		for (i = this.cur; realLines < numLines && i < this.lines.length; ++i) {
			var line = this.lines[i];
			realLines += (line.length > 1) ? Math.ceil(line.length / width) : 1;
			console.log(line);
			this.cur++;
		}


		this.showPrompt();
	}

	showPrompt() {
		var msg = '';
		if (this.cur != this.total) {
			msg = this.cur + '/' + this.total + ', ' + this.lines.length + ' more ';
		}
		this.msgLen = msg.length;
		process.stdout.write(col('yellow', msg + '> '));
	}
}

var screen = new Screen();

function printHeader(msg, type) {
	screen.write(' ');
	screen.write(col('yellow', msg));

	var gen = Math.ceil((msg.length - type.length) / 2);

	screen.write(Array(gen).join('-') + '[' + type + ']' + Array(gen).join('-'));
}

var lastReply = null;

function fetch(r, fileName) {
	client.get(r, (err, reply) => {
		var num = 0;
		if (err) {
			console.log(col('red', 'Error fetching ' + r.toShortURI()));
			if (err.message) {
				console.log(err.message);
			} else {
				console.error(err);
			}
		} else {
			if (!fileName) {
				history.merge(r);
			}
			screen.clear();
			var msg = reply.request.bytesReceived + ' bytes from ' + reply.request.resource.host + ' (' + reply.request.remoteAddress + ') in ' + reply.request.elapsed + ' ms.';
			lastReply = reply;

			if (reply.request.fileName) {
				printHeader(msg, 'Saved File');
				screen.write(col('green', 'File ' + reply.request.fileName + ' saved.'));
				history.setHist();
			} else if (reply.directory) {
				printHeader(msg, 'Directory');
				items = [];
				reply.directory.forEach((item) => {
					if (item.type != 'i' && item.type != '3') {
						items.push(item);
						num++;
						screen.write(typeToStr(item.type) + ' ' + ((num < 10) ? ' ' : '') + col('green', num) + ' ' + item.name);
					} else {
						if (item.type === '3') {
							screen.write(col('red', 'ERR') + '   ' + item.name);
						} else {
							screen.write('      ' + item.name);
						}
					}
				});
			} else if (reply.text) {
				printHeader(msg, 'Text');
				var lines = reply.text.replace(/\r/g, '').split('\n');
				lines.forEach((l) => {
					screen.write(l);
				});
			} else {
				printHeader(msg, 'Binary');
				screen.write(col('red', reply.request.bytesReceived + ' bytes was downloade to memory, "S filename" to save'));
			}
			screen.print();
		}
	}, fileName);
}

fetch(go);

var isSavingFile = false;
var curPos = 0;
var saveAsFn;
var itemToSave;

function doCmd(c) {

	if (isSavingFile) {
		//console.log(c);
		if (curPos > 0) {
			if (c == '\b') {
				curPos--;
				saveAsFn = saveAsFn.substring(0, curPos);
				process.stdout.write(cursor.left(1) + cursor.clearFromCursor());
			}
		}

		if (c.match(/\d|[a-z]| |\/|\\|\.|\,/i) && c.length === 1) {
			saveAsFn += c;
			process.stdout.write(c);
		} else if (c == '') {
			process.stdin.setRawMode(false);
			if (saveAsFn.length === 0) {
				console.log(col('red', 'Aborted.'));
				screen.showPrompt();
			} else {
				fetch(itemToSave, saveAsFn);
			}
			curPos = 0;
			isSavingFile = false;
			saveAsFn = '';
			itemToSave = null;
		}
		curPos = saveAsFn.length;
		return;
	}

	switch (c) {
		case '':
			screen.print();
			break;
		case 'q':
		case 'bye':
		case 'exit':
			console.log(col('green', 'Bye!'));
			process.exit(0);
			break;
		case 'n':
			history.next();
			break;
		case 'p':
			history.prev();
			break;
		case 'r':
			screen.restart();
			break;
		case 'R':
			history.setHist();
			break;
		case '?':
		case 'help':
			console.log();
			console.log(col('yellow', 'Instructions'));
			console.log('Number [query] ..... Visit menu item, send query if it is a search server');
			console.log('n .................. Next item in history');
			console.log('p .................. Previous item in history');
			console.log('h [Number].......... View history [or visit history item]');
			console.log('r .................. Reprint current item');
			console.log('R .................. Reload current item');
			console.log('g URL .............. Got to gopherspace');
			console.log('S filename ......... Save current item to file');
			console.log('s Number [filename]. Save menu item to file');
			console.log('?/help ............. This');
			console.log('q/bye/exit ......... Exit program');
			screen.showPrompt();
			break;
		default:

			if (c[0] == 'g') {
				c = c.substring(1);
				if (c[0] === ' ') {
					c = c.substring(1);
				}
				try {
					var res = new Gopher.Resource(c);
					fetch(res);
				} catch (e) {
					console.log(col('red', 'Could not fetch ' + c) + ': ' + e.message);
				}
			} else if (c[0] == 'h') {
				if (c === 'h') {
					history.list();
				} else {
					c = c.substring(1);
					if (c[0] === ' ') {
						c = c.substring(1);
					}
					try {
						var i = parseInt(c);
						history.setHist(i);
					} catch (e) {
						console.log(col('red', 'Invalid history item.'));
					}
				}
			} else if (c[0] == 'S') {
				c = c.substring(1);
				if (c[0] === ' ') {
					c = c.substring(1);
				}
				var data = lastReply.buffer || lastReply.text;
				if (!data && lastReply.directory) {
					data = JSON.stringify(lastReply.directory);
					console.log(col('yellow', 'Note: Saving directory listing as JSON...'));
				}
				if (!data) {
					console.log(col('red', 'Error, no data to save..'));
				} else {
					try {
						fs.writeFileSync(c, data);
						console.log(col('green', 'Saved ' + data.length + ' bytes to ' + c));
					} catch (e) {
						console.error('Error while saving file to disk: ' + e.message);
					}
				}
				screen.showPrompt();
			} else if (c[0] == 's') {
				var s = /(s)( +)?(\d+)( +)?(.+)?/.exec(c);
				try {
					var i = parseInt(s[3]);
					i--;
					if (!items[i]) {
						throw new Error();
					}
					var item = items[i];
					if (s[5]) {
						console.log(col('yellow', 'Saving ' + item.toShortURI() + ' to ' + s[5] + ' ...'));
						fetch(item, s[5]);
					} else {
						saveAsFn = path.basename(item.selector);
						curPos = saveAsFn.length;
						process.stdout.write(col('yellow', 'Filename> ') + saveAsFn);
						process.stdin.setRawMode(true);
						isSavingFile = true;
						itemToSave = item;
					}
				} catch (e) {
					console.log(col('red', 'Syntax error or invalid selection: ') + e.message);
					screen.showPrompt();
				}
			} else {
				var C = /(\d+)( +)?(.+)?/.exec(c);
				try {
					var i = parseInt(C[1]);
					i--;
					if (!items[i]) {
						throw new Error();
					}
					var item = items[i];
					if (C[3]) {
						item = new Gopher.Resource(item.host, item.port, item.selector, item.type, item.name, C[3]);
					}
					fetch(item);
				} catch (e) {
					console.log(col('yellow', 'Invalid command, ? for help.'));
					screen.showPrompt();
				}
			}
			break;

	}
}