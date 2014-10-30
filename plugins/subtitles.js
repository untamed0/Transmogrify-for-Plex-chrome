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

		for (var i = 0; i < subs.length; i++) {
			var codec = subs[i].getAttribute("codec");

			// make sure stream is a compatible subtitle format
			if (subFormats.indexOf(codec) === -1) {
				continue;
			}

			var key = subs[i].getAttribute("key");

			// sub is within a media container
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

			subsFound[langKey] = { "language" : lang , "file" : key + '?X-Plex-Token=' + global_plex_token };
		}

		if (subsFound.length === 0) {
			utils.debug("subtitles plugin: No suitable subtitles found");
			return false;
		}

// ----------- start test code
//		subtitles.insertSubSelectPage(subsFound);

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

	insertSubSelectPage: function(subs) {
		var selector = document.getElementById('subtitles-dropdown').getElementsByClassName('dropdown-menu')[0];
		if (selector) {
			for (var key in subs) {
				var sub = subs[key];
				var li = document.createElement("li");
				li.innerHTML = '<a onclick="event.preventDefault();transmogrifySubChange(\'' + sub.language + '\')" data-id="0" href="#">' + sub.language + ' (No Transcode)</a>';
				selector.insertBefore(li, selector.getElementsByTagName('li')[1]);
			}
		}
	},

	insertSubSelectPlayer: function(subs) {
		var controlsTimer = setInterval(function() {
			var selector = document.getElementById('subtitles-dropdown-list').getElementsByClassName('dropdown-menu')[0];
			if (selector && !document.getElementsByClassName('modal-backdrop')[0]) {
				clearInterval(controlsTimer);
				for (var key in subs) {
					var sub = subs[key];
					var li = document.createElement("li");
					li.innerHTML = '<a onclick="transmogrifySubChange(\'' + sub.language + '\');" data-id="0" href="#">' + sub.language + ' (No Transcode) <i class="player-dropdown-selected-icon dropdown-selected-icon glyphicon ok-2"></i></a>';
					selector.insertBefore(li, selector.getElementsByTagName('li')[1]);
				}
				selector.getElementsByTagName('li')[0].getElementsByTagName('a')[0].setAttribute("onclick", "transmogrifySubChange(false);");
			}
		}, 500);
	},

	play: function(subs, lang) {
		if (subtitles.jsInsert)
			return;
/*
	For future use when browsers add support for subtitles

		var track = document.createElement("track");
		track.setAttribute("kind", "captions");
		track.setAttribute("src", src + "?X-Plex-Token=" + global_plex_token);
		track.setAttribute("srclang", code);
		track.setAttribute("default", "");
		document.getElementById("html-video").appendChild(track);
*/
		// insert bubblesjs

		var bubblesScript = document.createElement("script");
		bubblesScript.src = chrome.extension.getURL("resources/subtitles/bubbles.js");
		document.head.appendChild(bubblesScript);

		// have to use setTimeout to allow bubblesjs to execute
		setTimeout(function() {
			var s2 = document.createElement('script');
			s2.textContent = 'function transmogrifySubChange(lang){ if (!lang) { TransmogrifySubs.subsShow(false); } else { TransmogrifySubs.subsShow(true); TransmogrifySubs.langChange(lang); } } var TransmogrifySubs = new Bubbles.video("html-video", false, null, true);TransmogrifySubs.subtitles(false, ' + JSON.stringify(subs) + '); ';

			if (!lang) {
				s2.textContent += 'transmogrifySubChange(false);';
			} else {
				s2.textContent += 'transmogrifySubChange("' + lang + '");';
			}

			document.head.appendChild(s2);
		}, 500);

		subtitles.jsInsert = true;
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

	alert: function(text) {
		var selector = document.getElementById("transmogrify-subtitle-alert");

		if (selector) {
			clearTimeout(subtitles.hideAlert);
			selector.style.display = 'none';
			selector.setAttribute("class", "alert alert-status");
			selector.getElementsByClassName('status')[0].innerText = text;
			selector.style.display = 'block';
		} else {
			var alert = document.createElement("div");
			alert.setAttribute("id", "transmogrify-subtitle-alert");
			alert.setAttribute("class", "alert alert-status");
			alert.innerHTML = '<i class="alert-icon glyphicon stopwatch"></i><span class="status">' + text + '</span>';
			document.getElementById("plex").appendChild(alert);
		}

		subtitles.hideAlert = setTimeout(function() {
			document.getElementById("transmogrify-subtitle-alert").setAttribute("class", "alert alert-status transition-out");
		}, 2000);
	}
}