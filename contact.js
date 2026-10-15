/* Contact form: builds an email to the owner and opens the visitor's email app.
   Nothing is sent or stored by this website. */
    (function () {
      'use strict';
      var EMAIL = window.PRODUCTIVE_EMAIL; // set by pages.js
      var $ = function (s) { return document.querySelector(s); };

      if (!EMAIL) return; // page is framed or pages.js didn't load

      var toastTimer;
      function toast(msg) {
        $('#toastText').textContent = msg;
        $('#toast').classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { $('#toast').classList.remove('show'); }, 3000);
      }
      function copy(text, done) {
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
          .then(function () { toast(done); })
          .catch(function () {
            var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); toast(done); } catch (e) { toast('Couldn’t copy. Please select and copy it manually.'); }
            ta.remove();
          });
      }

      // ---- Topic picker ----
      var topic = 'Question';
      function setTopic(v) {
        topic = v;
        document.querySelectorAll('#topic button').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.v === v)); });
        $('#techWrap').hidden = v !== 'Problem';
      }
      $('#topic').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setTopic(b.dataset.v); });

      // Coming from the error page or a broken link? Pre-fill.
      var params = new URLSearchParams(location.search);
      var lastError = null;
      if (params.get('topic') === 'problem') {
        setTopic('Problem');
        if (params.get('from') === 'error') {
          try { lastError = (JSON.parse(localStorage.getItem('productive.errors.v1') || '[]') || [])[0] || null; } catch (e) {}
          $('#cMessage').placeholder = 'What were you doing when it happened? (e.g. "I dragged a task to Friday")';
        } else if (params.get('page')) {
          $('#cMessage').value = 'This link seems to be broken: ' + params.get('page').slice(0, 300);
        }
      }

      var msg = $('#cMessage');
      function count() { $('#cCount').textContent = msg.value.length + ' / 1500'; }
      msg.addEventListener('input', function () { count(); $('#cError').textContent = ''; });
      count();

      // ---- Build the email ----
      function build() {
        var name = $('#cName').value.trim();
        var email = $('#cEmail').value.trim();
        var text = msg.value.trim();
        var subject = '[Productive] ' + topic + ': ' + (text.split('\n')[0].slice(0, 50) || 'Message');
        var lines = [text, '', '—', 'Topic: ' + topic];
        if (name) lines.push('Name: ' + name);
        if (email) lines.push('Reply to: ' + email);
        if (topic === 'Problem' && $('#cTech').checked) {
          lines.push('', 'Technical details:', 'Browser: ' + navigator.userAgent, 'Screen: ' + screen.width + '×' + screen.height);
          if (lastError) lines.push('Error: ' + lastError.message + ' (' + lastError.at + ', ' + lastError.page + ')');
        }
        lines.push('', 'Sent from the Productive contact form');
        return { subject: subject, body: lines.join('\n') };
      }

      $('#contactForm').addEventListener('submit', function (e) {
        e.preventDefault();
        if (msg.value.trim().length < 3) { $('#cError').textContent = 'Please write a message first.'; msg.focus(); return; }
        var em = $('#cEmail').value.trim();
        if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { $('#cError').textContent = 'That email address doesn’t look right. Fix it or leave it empty.'; $('#cEmail').focus(); return; }

        var m = build();
        var s = encodeURIComponent(m.subject), b = encodeURIComponent(m.body), to = encodeURIComponent(EMAIL);
        $('#gmailLink').href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + to + '&su=' + s + '&body=' + b;
        $('#outlookLink').href = 'https://outlook.live.com/mail/0/deeplink/compose?to=' + to + '&subject=' + s + '&body=' + b;
        $('#yahooLink').href = 'https://compose.mail.yahoo.com/?to=' + to + '&subject=' + s + '&body=' + b;
        $('#copyBtn').onclick = function () { copy('To: ' + EMAIL + '\nSubject: ' + m.subject + '\n\n' + m.body, 'Message copied. Paste it into any email.'); };

        $('#contactForm').hidden = true;
        $('#sent').hidden = false;
        window.location.href = 'mailto:' + EMAIL + '?subject=' + s + '&body=' + b;
        $('#sent').scrollIntoView({ block: 'start' });
      });

      $('#editBtn').addEventListener('click', function () { $('#sent').hidden = true; $('#contactForm').hidden = false; msg.focus(); });
      $('#copyAddr').addEventListener('click', function () { copy(EMAIL, 'Email address copied.'); });
    })();
  
