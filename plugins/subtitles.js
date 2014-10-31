subtitles = {
	metadata_xml: null,
	sync: 0,
	hideAlert: null,
	jsInsert: false,

	init: function(metadata_xml, page) {
		subtitles.metadata_xml = metadata_xml;

		subtitles.fetchSubs();
	},

	fetchSubs: function() {
		var subFormats = [ 'srt' ]; // just srt for now, maybe convert .sub etc to .srt?
		var subsFound = {};
		var subs = subtitles.metadata_xml.getElementsByTagName("MediaContainer")[0].getElementsByTagName("Video")[0].getElementsByTagName("Media")[0].getElementsByTagName("Part")[0].getElementsByTagName("Stream");

		// loop through the different streams
		for (var i = 0; i < subs.length; i++) {
			var codec = subs[i].getAttribute("codec");

			// make sure stream is a compatible subtitle format
			if (subFormats.indexOf(codec) === -1) {
				continue;
			}

			var key = subs[i].getAttribute("key");

			// no key attribute means sub is within a media container
			if (!key) {
				return;
			}

			var lang = subs[i].getAttribute("language");
			var code = subs[i].getAttribute("languageCode");

			if (!lang) {
				lang = 'Unknown';
				code = '';
			}

			// number any duplicates with 2,3,4 etc
			var langKey = lang;
			var num = 2;
			while (subsFound[langKey]) {
				langKey = lang + " " + num; 
				num++;
			}

			// required format for bubblesjs, languageCode is currently unused but may be needed in future
			subsFound[langKey] = { "language" : lang , "file" : key + '?X-Plex-Token=' + global_plex_token };
		}

		if (subsFound.length === 0) {
			utils.debug("subtitles plugin: No suitable subtitles found");
			return false;
		}

// ----------- start test code
		var isPlaying = setInterval(function() {
			if (document.getElementById("html-video")) {
				clearInterval(isPlaying);
				subtitles.insertSubSelectPlayer(subsFound);
				subtitles.play(subsFound);
			}
		}, 500);
// ----------- end test code

		return subsFound;
	},

	insertSubSelectPlayer: function(subs) {
		// wait for the subtitle icon to appear
		var controlsTimer = setInterval(function() {
			var selector = document.getElementById('subtitles-dropdown-list');
			if (selector && selector.getElementsByClassName('dropdown-menu')[0] && !document.getElementsByClassName('modal-backdrop')[0]) {
				selector = selector.getElementsByClassName('dropdown-menu')[0];
				clearInterval(controlsTimer);
				for (var key in subs) {
					var sub = subs[key];
					var li = document.createElement("li");
					li.innerHTML = '<a onclick="transmogrifySubChange(\'' + sub.language + '\');" data-id="0" href="#">' + sub.language + ' (No Transcode) <i class="player-dropdown-selected-icon dropdown-selected-icon glyphicon ok-2"></i></a>';
					selector.insertBefore(li, selector.getElementsByTagName('li')[1]);
				}
				// selecting 'none' disables the subtitles
				selector.getElementsByTagName('li')[0].getElementsByTagName('a')[0].setAttribute("onclick", "transmogrifySubChange(false);");
			}
		}, 500);
	},

	play: function(subs, lang) {
/*
	For future use when browsers add support for subtitles

		var track = document.createElement("track");
		track.setAttribute("kind", "captions");
		track.setAttribute("src", src + "?X-Plex-Token=" + global_plex_token);
		track.setAttribute("srclang", code);
		track.setAttribute("default", "");
		document.getElementById("html-video").appendChild(track);
*/
		// insert bubblesjs if it hasn't already been inserted
		if (!subtitles.jsInsert) {
			var bubblesScript = document.createElement("script");
			bubblesScript.src = chrome.extension.getURL("resources/subtitles/bubbles.js");
			document.head.appendChild(bubblesScript);

			subtitles.jsInsert = true;
		}

		// make sure old code is removed
		var selector = document.getElementById("transmogrify-script");
		if (selector) {
			selector.parentNode.removeChild(selector);
		}

		// have to use setTimeout to allow bubblesjs to execute
		setTimeout(function() {
			var s2 = document.createElement('script');
			s2.setAttribute("id", "transmogrify-script");
			s2.textContent = 'function transmogrifySubChange(lang){ if (!lang) { TransmogrifySubs.subsShow(false); } else { TransmogrifySubs.subsShow(true); TransmogrifySubs.langChange(lang); } } var TransmogrifySubs = new Bubbles.video("html-video", false, null, true);TransmogrifySubs.subtitles(false, ' + JSON.stringify(subs) + '); ';

			if (!lang) { // if no subtitle was selected
				s2.textContent += 'transmogrifySubChange(false);';
			} else {
				s2.textContent += 'transmogrifySubChange("' + lang + '");';
			}

			document.head.appendChild(s2);
		}, 500);

		subtitles.hotkeysInit();
	},

	hotkeysInit: function() {
		document.onkeydown = function(e) {
			if (e.which == 71) { // g
				utils.debug("subtitles plugin: G hotkey pressed, decreasing subtitle timing");
				subtitles.hotkeys('subtract');
			} else if (e.which == 72) { // h
				utils.debug("subtitles plugin: H hotkey pressed, increasing subtitle timing");
				subtitles.hotkeys('add');
			} else if (e.which == 86) { // v
				utils.debug("subtitles plugin: V hotkey pressed, toggling subtitles");
				subtitles.hotkeys('toggle');
			}
		}
	},

	hotkeys: function(act) {
		var ss = document.createElement('script');

		if (act == 'toggle') {
			subtitles.alert('Toggling subtitles');
			ss.textContent = 'TransmogrifySubs.subsToggle()';
		} else {
			if (act == "add") {
				subtitles.sync++;
			} else if (act == 'subtract') {
				subtitles.sync--;
			}

			var sec = 0.05 * subtitles.sync;
			ss.textContent = 'TransmogrifySubs.subsSync(' + sec + ')';
			subtitles.alert('Subtitle delay ' + Math.round(sec * 1000) + 'ms');
		}

		document.head.appendChild(ss);
		ss.parentNode.removeChild(ss);
	},

	alert: function(text, timeout) {
		var selector = document.getElementById("transmogrify-subtitle-alert");

		if (selector) {
			// prevent animations stacking
			clearTimeout(subtitles.hideAlert);

			selector.style.display = 'none';
			selector.setAttribute("class", "alert alert-status"); //remove transition-out class
			selector.getElementsByClassName('status')[0].innerText = text;
			selector.style.display = 'block';
		} else {
			var alert = document.createElement("div");
			alert.setAttribute("id", "transmogrify-subtitle-alert");
			alert.setAttribute("class", "alert alert-status"); //remove transition-out class
			alert.innerHTML = '<i class="alert-icon glyphicon stopwatch"></i><span class="status">' + text + '</span>';
			document.getElementById("plex").appendChild(alert);
		}

		if (!timeout)
			var timeout = 2;

		subtitles.hideAlert = setTimeout(function() {
			document.getElementById("transmogrify-subtitle-alert").setAttribute("class", "alert alert-status transition-out");
		}, timeout * 1000);
	}
}