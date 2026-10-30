/* Decrocho : comportements du site, sans dépendance ni traceur. */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  root.classList.add('js');

  function toArray(list) { return Array.prototype.slice.call(list); }
  function onMedia(query, fn) {
    var mq = window.matchMedia(query);
    if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn);
    return mq;
  }

  /* 1. Menu sur mobile */
  var toggle = doc.querySelector('.nav-toggle');
  var nav = doc.getElementById('menu');
  if (toggle && nav) {
    var setOpen = function (open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    doc.addEventListener('click', function (e) {
      if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    onMedia('(min-width: 961px)', function (m) { if (m.matches) setOpen(false); });
  }

  /* 2. Onglets des métiers (clavier : flèches, Début, Fin ; lien direct : metiers.html#electricite) */
  var tablist = doc.querySelector('[role="tablist"]');
  if (tablist) {
    var tabs = toArray(tablist.querySelectorAll('[role="tab"]'));
    var select = function (tab, opts) {
      opts = opts || {};
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = doc.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (opts.focus) tab.focus();
      if (opts.hash && window.history && history.replaceState) {
        history.replaceState(null, '', '#' + tab.getAttribute('aria-controls'));
      }
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, { hash: true }); });
      t.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) {
          e.preventDefault();
          select(next, { focus: true, hash: true });
          if (next.scrollIntoView) next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      });
    });
    var fromHash = function () {
      var id = decodeURIComponent(location.hash.slice(1));
      var match = tabs.filter(function (t) { return t.getAttribute('aria-controls') === id; })[0];
      if (match) {
        select(match);
        tablist.scrollIntoView({ block: 'start' });
      }
    };
    select(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0]);
    fromHash();
    window.addEventListener('hashchange', fromHash);
  }

  /* 3. Sommaire qui suit la lecture (page Fonctionnement) */
  var sommaire = doc.querySelector('.sommaire');
  if (sommaire && 'IntersectionObserver' in window) {
    var links = toArray(sommaire.querySelectorAll('a[href^="#"]'));
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var activate = function (id) {
      links.forEach(function (a) {
        var on = a === byId[id];
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) activate(en.target.id); });
    }, { rootMargin: '-30% 0px -60% 0px' });
    Object.keys(byId).forEach(function (id) {
      var el = doc.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* 4. Simulateur de tarifs */
  var calc = doc.getElementById('simulateur');
  if (calc) {
    var offres = JSON.parse(calc.getAttribute('data-offres'));
    var appels = doc.getElementById('appels');
    var visites = doc.getElementById('visites');
    var outMontant = calc.querySelector('[data-montant]');
    var outOffre = calc.querySelector('[data-offre]');
    var outAppels = calc.querySelector('[data-appels]');
    var outDetail = calc.querySelector('[data-detail]');
    var euros = function (x) {
      var cents = Math.round(x * 100);
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency: 'EUR',
        minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2
      }).format(cents / 100);
    };
    var nombre = function (el, max) {
      var v = parseFloat(String(el.value).replace(',', '.'));
      if (!isFinite(v) || v < 0) return 0;
      return Math.min(v, max);
    };
    var nbAppels = function (n) {
      return new Intl.NumberFormat('fr-FR').format(n) + (n > 1 ? ' appels' : ' appel');
    };
    var update = function () {
      var n = Math.round(nombre(appels, 5000));
      var avecVisites = visites.value === 'oui';
      var lignes = offres.map(function (o) {
        var extra = Math.max(0, n - o.appels);
        return { o: o, extra: extra, total: Math.round((o.prix + extra * o.depassement) * 100) / 100, possible: o.visites || !avecVisites };
      });
      // à prix égal, la formule qui inclut le plus d'appels
      var best = lignes.filter(function (l) { return l.possible; }).reduce(function (a, b) {
        return b.total < a.total || (b.total === a.total && b.o.appels > a.o.appels) ? b : a;
      });
      outMontant.textContent = euros(best.total);
      outOffre.textContent = best.o.nom;
      outAppels.textContent = nbAppels(n);
      outDetail.innerHTML = '';
      lignes.forEach(function (l) {
        var li = doc.createElement('li');
        if (l === best) li.className = 'is-best';
        else if (!l.possible) li.className = 'is-off';
        var a = doc.createElement('span');
        a.textContent = l.o.nom + (!l.possible ? ' (sans visites)' : l.extra ? ' (+ ' + nbAppels(l.extra) + ')' : '');
        var b = doc.createElement('span');
        b.textContent = euros(l.total);
        li.appendChild(a); li.appendChild(b);
        outDetail.appendChild(li);
      });
    };
    appels.addEventListener('input', update);
    visites.addEventListener('change', update);
    update();
  }

  /* 5. Copier un texte */
  var copier = function (texte) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texte);
    }
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = texte;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      doc.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (err) { ok = false; }
      doc.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error('copie impossible'));
    });
  };
  doc.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copier]');
    if (!btn) return;
    var cible = doc.getElementById(btn.getAttribute('data-copier'));
    var texte = cible ? (cible.value || cible.textContent) : '';
    var label = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', label);
    var retour = function (msg) {
      btn.textContent = msg;
      window.setTimeout(function () { btn.textContent = label; }, 2200);
    };
    copier(texte.trim()).then(function () { retour('Copié'); }, function () {
      if (cible) {
        var range = doc.createRange();
        range.selectNodeContents(cible);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      retour('Sélectionné : Ctrl+C pour copier');
    });
  });

  /* 6. Formulaire de contact : prépare un e-mail, rien n'est envoyé ni gardé par le site */
  var form = doc.getElementById('form-contact');
  if (form) {
    var dest = form.getAttribute('data-email');
    var champ = function (name) { return form.elements[name]; };
    var erreur = function (el, message) {
      var box = doc.getElementById('err-' + el.name);
      if (message) {
        el.setAttribute('aria-invalid', 'true');
        if (box) { box.textContent = message; box.hidden = false; }
      } else {
        el.removeAttribute('aria-invalid');
        if (box) { box.textContent = ''; box.hidden = true; }
      }
    };
    toArray(form.querySelectorAll('input, select, textarea')).forEach(function (el) {
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid')) erreur(el, ''); });
    });
    form.setAttribute('novalidate', '');
    var voulue = (location.search.match(/[?&]formule=([^&]+)/) || [])[1];
    if (voulue && champ('formule')) {
      toArray(champ('formule').options).forEach(function (o) {
        if (o.value && o.value.toLowerCase() === decodeURIComponent(voulue).toLowerCase()) champ('formule').value = o.value;
      });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nom = champ('nom');
      var tel = champ('telephone');
      var premier = null;
      if (!nom.value.trim()) { erreur(nom, 'Indiquez votre nom.'); premier = premier || nom; } else erreur(nom, '');
      var chiffres = tel.value.replace(/[^0-9]/g, '');
      if (!chiffres) { erreur(tel, 'Indiquez un numéro pour vous rappeler.'); premier = premier || tel; }
      else if (chiffres.length < 10) { erreur(tel, 'Ce numéro semble incomplet.'); premier = premier || tel; }
      else erreur(tel, '');
      if (premier) { premier.focus(); return; }

      var val = function (name) { var el = champ(name); return el && el.value ? el.value.trim() : ''; };
      var lignes = [
        'Bonjour,',
        '',
        'Je souhaite être rappelé(e) au sujet de Decrocho.',
        '',
        'Nom : ' + val('nom')
      ];
      if (val('entreprise')) lignes.push('Entreprise : ' + val('entreprise'));
      if (val('metier')) lignes.push('Métier : ' + val('metier'));
      lignes.push('Téléphone : ' + val('telephone'));
      if (val('commune')) lignes.push('Commune : ' + val('commune'));
      if (val('moment')) lignes.push('Meilleur moment pour me rappeler : ' + val('moment'));
      if (val('formule')) lignes.push('Formule qui m\'intéresse : ' + val('formule'));
      if (val('message')) { lignes.push('', 'Message :', val('message')); }
      lignes.push('', 'Merci.');
      var corps = lignes.join('\n');
      var sujet = 'Demande de rappel : ' + val('nom') + (val('entreprise') ? ' (' + val('entreprise') + ')' : '');
      var href = 'mailto:' + dest + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);

      var panneau = doc.getElementById('envoi');
      doc.getElementById('envoi-texte').textContent = corps;
      doc.getElementById('envoi-lien').setAttribute('href', href);
      panneau.hidden = false;
      panneau.focus();
      try { window.location.href = href; } catch (err) { /* la messagerie ne s'ouvre pas : le texte reste à copier */ }
    });
  }

  /* 7. Année du pied de page */
  toArray(doc.querySelectorAll('[data-annee]')).forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
