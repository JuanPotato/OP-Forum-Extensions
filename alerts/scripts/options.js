$(document).ready(function () {
	var refreshInterval = localStorage.getItem('refreshInterval');

	if (refreshInterval === null) {
		refreshInterval = "300";
	}
	$("option[value=" + refreshInterval + "]").attr("selected","selected");
	
	$("#refreshInterval").on("change", function () {
		localStorage.setItem('refreshInterval', $(this).val());
        chrome.runtime.sendMessage({action : 'notificationIntervalChanged'});
	});
});
