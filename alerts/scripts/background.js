var forumUrl = "https://forums.oneplus.net/";
var feedUrl = "https://forums.oneplus.net/members/66909/?card=1&_xfResponseType=json";

var oldChromeVersion = !chrome.runtime;
var requestTimerId;

function isForumUrl(url) {
	return url.indexOf(forumUrl) === 0;
}

function updateIcon() {
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
				path : "red_alert.png"
			});
		} else {
			chrome.browserAction.setIcon({
				path : "grey_alert.png"
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
	try {
		$.get(feedUrl, function (data) {
			localStorage.requestFailureCount = 0;
			if (data._visitor_conversationsUnread !== undefined) {
				onSuccess(data._visitor_alertsUnread);
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
	if (!oldChromeVersion) {
		// TODO(mpcomplete): We should be able to remove this now, but leaving it
		// for a little while just to be sure the refresh alarm is working nicely.
		chrome.alarms.create('watchdog', {
			periodInMinutes : 5
		});
	}
}

function onAlarm(alarm) {
	startRequest(false);
	console.log('Got alarm', alarm);
	if (alarm && alarm.name == 'watchdog') {
		onWatchdog();
	} else {
		startRequest(true);
	}
}

function onWatchdog() {
	chrome.alarms.get('refresh', function (alarm) {
		if (alarm) {
			console.log('Refresh alarm exists. Yay.');
		} else {
			console.log('Refresh alarm doesn\'t exist!? ' +
				'Refreshing now and rescheduling.');
			startRequest(true);
		}
	});
}

if (oldChromeVersion) {
	updateIcon();
	onInit();
} else {
	chrome.runtime.onInstalled.addListener(onInit);
	chrome.alarms.onAlarm.addListener(onAlarm);
}

var filters = {
	// TODO(aa): Cannot use urlPrefix because all the url fields lack the protocol
	// part. See crbug.com/140238.
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
  function(request, sender, sendResponse) {
    console.log(sender.tab ?
                "from a content script:" + sender.tab.url :
                "from the extension");
    if (request.action == 'notificationIntervalChanged') {
		chrome.alarms.clearAll();
		startRequest(true);
	}
  });
  
setTimeout(function () {
	getInboxCount(
		function (count) {
		updateUnreadCount(count);
	});
	chrome.extension.getBackgroundPage().console.log('foo');
}, 1000);
