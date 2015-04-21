var forumUrl = "https://forums.oneplus.net/conversations/";
var feedUrl = "https://forums.oneplus.net/?_xfResponseType=json";

var oldChromeVersion = !chrome.runtime;
var requestTimerId;

function isForumUrl(url) {
	return url.indexOf(forumUrl) === 0;
}

function updateIcon() {
	console.log("Updating Icon...");
	if (!localStorage.hasOwnProperty('unreadCount')) {
		chrome.browserAction.setBadgeBackgroundColor({
			color : [190, 190, 190, 230]
		});
		chrome.browserAction.setBadgeText({
			text : "???"
		});
	} else {
		chrome.browserAction.setBadgeBackgroundColor({
			color : [208, 0, 24, 255]
		});
		chrome.browserAction.setBadgeText({
			text : localStorage.unreadCount !== "0" ? localStorage.unreadCount : ""
		});
		if (parseInt(localStorage.unreadCount) > 0) {
			chrome.browserAction.setIcon({
				path : "red_message.png"
			});
		} else {
			chrome.browserAction.setIcon({
				path : "grey_message.png"
			});
		}
	}
}

function scheduleRequest() {
	console.log('scheduleRequest');
	if (localStorage.getItem('refreshInterval') === null) {
		localStorage.setItem('refreshInterval', "300"); //seconds
	}
	var delay = parseInt(localStorage.getItem('refreshInterval'));
	console.log('Scheduling for: ' + delay / 60 + " minutes");

	if (oldChromeVersion) {
		if (requestTimerId) {
			window.clearTimeout(requestTimerId);
		}
		requestTimerId = window.setTimeout(onAlarm, delay * 1000);
	} else {
		console.log('Creating alarm');
		chrome.alarms.create('refresh', {
			periodInMinutes : delay / 60
		});
	}
}

// ajax stuff
function startRequest(params) {
	if (params) {
		scheduleRequest();
	}

	getInboxCount(
		function (count) {
		updateUnreadCount(count);
	});
}

function getInboxCount(onSuccess) {
	console.log("Checking for PMs...");
	try {
		$.get(feedUrl, function (data) {
			localStorage.requestFailureCount = 0;
			if (data._visitor_conversationsUnread !== undefined) {
				onSuccess(data._visitor_conversationsUnread);
			} else {
				onSuccess("log in");
			}
		});
	} catch (e) {
		console.error(e);
	}
}

function updateUnreadCount(count) {
	localStorage.unreadCount = count;
	updateIcon();
}

function goToInbox() {
	console.log('Going to inbox...');
	chrome.tabs.getAllInWindow(undefined, function (tabs) {
		for (var i = 0, tab; tab = tabs[i]; i++) {
			if (tab.url && isForumUrl(tab.url)) {
				console.log('Found Forum tab: ' + tab.url + '. ' +
					'Focusing and refreshing count...');
				chrome.tabs.update(tab.id, {
					selected : true
				});
				startRequest(false);
				return;
			}
		}
		console.log('Could not find Forum tab. Creating one...');
		chrome.tabs.create({
			url : forumUrl
		});
	});
}

function onInit() {
	console.log('onInit');
	localStorage.requestFailureCount = 0; // used for exponential backoff
	startRequest(true);
}

function onAlarm(alarm) {
	console.log('Got alarm', alarm);
	if (alarm) {
		startRequest(true);
	} else {
		startRequest(false);
	}
}

if (oldChromeVersion) {
	updateIcon();
	onInit();
} else {
	chrome.runtime.onInstalled.addListener(onInit);
	chrome.alarms.onAlarm.addListener(onAlarm);
}

var filters = {
	url : [{
			urlContains : forumUrl.replace(/^https?\:\/\//, '')
		}
	]
};

function onNavigate(details) {
	if (details.url && isForumUrl(details.url)) {
		console.log('Recognized Forum navigation to: ' + details.url + '.' +
			'Refreshing count...');
		startRequest(false);
	}
}
if (chrome.webNavigation && chrome.webNavigation.onDOMContentLoaded &&
	chrome.webNavigation.onReferenceFragmentUpdated) {
	chrome.webNavigation.onDOMContentLoaded.addListener(onNavigate, filters);
	chrome.webNavigation.onReferenceFragmentUpdated.addListener(
		onNavigate, filters);
} else {
	chrome.tabs.onUpdated.addListener(function (_, details) {
		onNavigate(details);
	});
}

chrome.browserAction.onClicked.addListener(goToInbox);

if (chrome.runtime && chrome.runtime.onStartup) {
	chrome.runtime.onStartup.addListener(function () {
		console.log('Starting browser... updating icon.');
		startRequest(false);
		updateIcon();
	});
} else {
	chrome.windows.onCreated.addListener(function () {
		console.log('Window created... updating icon.');
		startRequest(false);
		updateIcon();
	});
}

chrome.runtime.onMessage.addListener(
	function (request, sender, sendResponse) {
	console.log(sender.tab ?
		"from a content script:" + sender.tab.url :
		"from the extension");
	if (request.action == 'notificationIntervalChanged') {
		chrome.alarms.clearAll();
		startRequest(true);
	}
});
