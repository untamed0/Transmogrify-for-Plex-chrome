subtitles = {
	metadata_xml: null,

	init: function(metadata_xml, page) {
		subtitles.metadata_xml = metadata_xml;

		subtitles.fetchSubs();
	},

	fetchSubs: function() {
		var subFormats = [ 'srt' ]; // just srt for now, maybe convert .sub etc to .srt?
		var subsFound = [];
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

			subsFound.push({ "lang" : lang , "code" : code , "type" : codec , "path" : key });
		}

		if (subsFound.length === 0) {
			utils.debug("subtitles plugin: No suitable subtitles found");
			return false;
		}

// ----------- start test code
		var isPlaying = setInterval(function() {

			if (document.getElementById("html-video")) {
				clearInterval(isPlaying);
				subtitles.play(subsFound[0].path, subsFound[0].code, subsFound[0].lang);
			}
		
		}, 500);
// ----------- end test code

		return subsFound;
	},

	insertSelection: function() {
		//insert html
	},

	play: function(src, code, lang) {
/*
	For future use when browsers add support for subtitles

		var track = document.createElement("track");
		track.setAttribute("kind", "captions");
		track.setAttribute("src", src + "?X-Plex-Token=" + global_plex_token);
		track.setAttribute("srclang", code);
		track.setAttribute("default", "");
		document.getElementById("html-video").appendChild(track);
*/

		// insert bubblejs
		var bubblesScript = document.createElement("script");
		bubblesScript.src = chrome.extension.getURL("resources/subtitles/bubbles.js");
		document.head.appendChild(bubblesScript);

		// have to use setTimeout to allow bubblejs to execute
		setTimeout(function() {
			var s2 = document.createElement('script');
			s2.textContent = 'new Bubbles.video("html-video", false, null, true).subtitles(false, { "' + lang + '" : { language : "' + lang + '", file : "' + src + '?X-Plex-Token=' + global_plex_token + '" } });';
			document.head.appendChild(s2);
			s2.parentNode.removeChild(s2);
		}, 500);
	}
}