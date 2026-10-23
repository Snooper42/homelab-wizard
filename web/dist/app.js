(() => {
  // node_modules/preact/dist/preact.module.js
  var n;
  var l;
  var u;
  var t;
  var i;
  var r;
  var o;
  var e;
  var f;
  var c;
  var a;
  var s;
  var h;
  var p;
  var v;
  var y;
  var d = {};
  var w = [];
  var _ = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
  var g = Array.isArray;
  function m(n2, l3) {
    for (var u4 in l3) n2[u4] = l3[u4];
    return n2;
  }
  function b(n2) {
    n2 && n2.parentNode && n2.parentNode.removeChild(n2);
  }
  function k(l3, u4, t3) {
    var i3, r3, o3, e3 = {};
    for (o3 in u4) "key" == o3 ? i3 = u4[o3] : "ref" == o3 ? r3 = u4[o3] : e3[o3] = u4[o3];
    if (arguments.length > 2 && (e3.children = arguments.length > 3 ? n.call(arguments, 2) : t3), "function" == typeof l3 && null != l3.defaultProps) for (o3 in l3.defaultProps) void 0 === e3[o3] && (e3[o3] = l3.defaultProps[o3]);
    return x(l3, e3, i3, r3, null);
  }
  function x(n2, t3, i3, r3, o3) {
    var e3 = { type: n2, props: t3, key: i3, ref: r3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == o3 ? ++u : o3, __i: -1, __u: 0 };
    return null == o3 && null != l.vnode && l.vnode(e3), e3;
  }
  function S(n2) {
    return n2.children;
  }
  function C(n2, l3) {
    this.props = n2, this.context = l3;
  }
  function $(n2, l3) {
    if (null == l3) return n2.__ ? $(n2.__, n2.__i + 1) : null;
    for (var u4; l3 < n2.__k.length; l3++) if (null != (u4 = n2.__k[l3]) && null != u4.__e) return u4.__e;
    return "function" == typeof n2.type ? $(n2) : null;
  }
  function I(n2) {
    if (n2.__P && n2.__d) {
      var u4 = n2.__v, t3 = u4.__e, i3 = [], r3 = [], o3 = m({}, u4);
      o3.__v = u4.__v + 1, l.vnode && l.vnode(o3), q(n2.__P, o3, u4, n2.__n, n2.__P.namespaceURI, 32 & u4.__u ? [t3] : null, i3, null == t3 ? $(u4) : t3, !!(32 & u4.__u), r3), o3.__v = u4.__v, o3.__.__k[o3.__i] = o3, D(i3, o3, r3), u4.__e = u4.__ = null, o3.__e != t3 && P(o3);
    }
  }
  function P(n2) {
    if (null != (n2 = n2.__) && null != n2.__c) return n2.__e = n2.__c.base = null, n2.__k.some(function(l3) {
      if (null != l3 && null != l3.__e) return n2.__e = n2.__c.base = l3.__e;
    }), P(n2);
  }
  function A(n2) {
    (!n2.__d && (n2.__d = true) && i.push(n2) && !H.__r++ || r != l.debounceRendering) && ((r = l.debounceRendering) || o)(H);
  }
  function H() {
    try {
      for (var n2, l3 = 1; i.length; ) i.length > l3 && i.sort(e), n2 = i.shift(), l3 = i.length, I(n2);
    } finally {
      i.length = H.__r = 0;
    }
  }
  function L(n2, l3, u4, t3, i3, r3, o3, e3, f4, c3, a3) {
    var s3, h3, p3, v3, y3, _2, g2 = t3 && t3.__k || w, m3 = l3.length;
    for (f4 = T(u4, l3, g2, f4, m3), s3 = 0; s3 < m3; s3++) null != (p3 = u4.__k[s3]) && (h3 = -1 != p3.__i && g2[p3.__i] || d, p3.__i = s3, _2 = q(n2, p3, h3, i3, r3, o3, e3, f4, c3, a3), v3 = p3.__e, p3.ref && h3.ref != p3.ref && (h3.ref && J(h3.ref, null, p3), a3.push(p3.ref, p3.__c || v3, p3)), null == y3 && null != v3 && (y3 = v3), 4 & p3.__u ? (f4 = j(p3, f4, n2), h3.__e && (h3.__e = null)) : "function" == typeof p3.type && void 0 !== _2 ? f4 = _2 : v3 && (f4 = v3.nextSibling), p3.__u &= -7);
    return u4.__e = y3, f4;
  }
  function T(n2, l3, u4, t3, i3) {
    var r3, o3, e3, f4, c3, a3 = u4.length, s3 = a3, h3 = 0;
    for (n2.__k = new Array(i3), r3 = 0; r3 < i3; r3++) null != (o3 = l3[r3]) && "boolean" != typeof o3 && "function" != typeof o3 ? ("string" == typeof o3 || "number" == typeof o3 || "bigint" == typeof o3 || o3.constructor == String ? o3 = n2.__k[r3] = x(null, o3, null, null, null) : g(o3) ? o3 = n2.__k[r3] = x(S, { children: o3 }, null, null, null) : void 0 === o3.constructor && o3.__b > 0 ? o3 = n2.__k[r3] = x(o3.type, o3.props, o3.key, o3.ref ? o3.ref : null, o3.__v) : n2.__k[r3] = o3, f4 = r3 + h3, o3.__ = n2, o3.__b = n2.__b + 1, e3 = null, -1 != (c3 = o3.__i = O(o3, u4, f4, s3)) && (s3--, (e3 = u4[c3]) && (e3.__u |= 2)), null == e3 || null == e3.__v ? (-1 == c3 && (i3 > a3 ? h3-- : i3 < a3 && h3++), "function" != typeof o3.type && (o3.__u |= 4)) : c3 != f4 && (c3 == f4 - 1 ? h3-- : c3 == f4 + 1 ? h3++ : (c3 > f4 ? h3-- : h3++, o3.__u |= 4))) : n2.__k[r3] = null;
    if (s3) for (r3 = 0; r3 < a3; r3++) null != (e3 = u4[r3]) && 0 == (2 & e3.__u) && (e3.__e == t3 && (t3 = $(e3)), K(e3, e3));
    return t3;
  }
  function j(n2, l3, u4) {
    var t3, i3;
    if ("function" == typeof n2.type) {
      for (t3 = n2.__k, i3 = 0; t3 && i3 < t3.length; i3++) t3[i3] && (t3[i3].__ = n2, l3 = j(t3[i3], l3, u4));
      return l3;
    }
    n2.__e != l3 && (l3 && n2.type && !l3.parentNode && (l3 = $(n2)), l3 = u4.insertBefore(n2.__e, l3 || null));
    do {
      l3 = l3 && l3.nextSibling;
    } while (null != l3 && 8 == l3.nodeType);
    return l3;
  }
  function O(n2, l3, u4, t3) {
    var i3, r3, o3, e3 = n2.key, f4 = n2.type, c3 = l3[u4], a3 = null != c3 && 0 == (2 & c3.__u);
    if (null === c3 && null == e3 || a3 && e3 == c3.key && f4 == c3.type) return u4;
    if (t3 > (a3 ? 1 : 0)) {
      for (i3 = u4 - 1, r3 = u4 + 1; i3 >= 0 || r3 < l3.length; ) if (null != (c3 = l3[o3 = i3 >= 0 ? i3-- : r3++]) && 0 == (2 & c3.__u) && e3 == c3.key && f4 == c3.type) return o3;
    }
    return -1;
  }
  function z(n2, l3, u4) {
    "-" == l3[0] ? n2.setProperty(l3, null == u4 ? "" : u4) : n2[l3] = null == u4 ? "" : "number" != typeof u4 || _.test(l3) ? u4 : u4 + "px";
  }
  function N(n2, l3, u4, t3, i3) {
    var r3, o3;
    n: if ("style" == l3) if ("string" == typeof u4) n2.style.cssText = u4;
    else {
      if ("string" == typeof t3 && (n2.style.cssText = t3 = ""), t3) for (l3 in t3) u4 && l3 in u4 || z(n2.style, l3, "");
      if (u4) for (l3 in u4) t3 && u4[l3] == t3[l3] || z(n2.style, l3, u4[l3]);
    }
    else if ("o" == l3[0] && "n" == l3[1]) r3 = l3 != (l3 = l3.replace(s, "$1")), o3 = l3.toLowerCase(), l3 = o3 in n2 || "onFocusOut" == l3 || "onFocusIn" == l3 ? o3.slice(2) : l3.slice(2), n2.l || (n2.l = {}), n2.l[l3 + r3] = u4, u4 ? t3 ? u4[a] = t3[a] : (u4[a] = h, n2.addEventListener(l3, r3 ? v : p, r3)) : n2.removeEventListener(l3, r3 ? v : p, r3);
    else {
      if ("http://www.w3.org/2000/svg" == i3) l3 = l3.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
      else if ("width" != l3 && "height" != l3 && "href" != l3 && "list" != l3 && "form" != l3 && "tabIndex" != l3 && "download" != l3 && "rowSpan" != l3 && "colSpan" != l3 && "role" != l3 && "popover" != l3 && l3 in n2) try {
        n2[l3] = null == u4 ? "" : u4;
        break n;
      } catch (n3) {
      }
      "function" == typeof u4 || (null == u4 || false === u4 && "-" != l3[4] ? n2.removeAttribute(l3) : n2.setAttribute(l3, "popover" == l3 && 1 == u4 ? "" : u4));
    }
  }
  function V(n2) {
    return function(u4) {
      if (this.l) {
        var t3 = this.l[u4.type + n2];
        if (null == u4[c]) u4[c] = h++;
        else if (u4[c] < t3[a]) return;
        return t3(l.event ? l.event(u4) : u4);
      }
    };
  }
  function q(n2, u4, t3, i3, r3, o3, e3, f4, c3, a3) {
    var s3, h3, p3, v3, y3, d3, _2, k3, x2, M, I2, P2, A2, H2, T2, j3, F = u4.type;
    if (void 0 !== u4.constructor) return null;
    128 & t3.__u && (c3 = !!(32 & t3.__u), o3 = [f4 = u4.__e = t3.__e]), (s3 = l.__b) && s3(u4);
    n: if ("function" == typeof F) {
      h3 = e3.length;
      try {
        if (x2 = u4.props, M = F.prototype && F.prototype.render, I2 = (s3 = F.contextType) && i3[s3.__c], P2 = s3 ? I2 ? I2.props.value : s3.__ : i3, t3.__c ? k3 = (p3 = u4.__c = t3.__c).__ = p3.__E : (M ? u4.__c = p3 = new F(x2, P2) : (u4.__c = p3 = new C(x2, P2), p3.constructor = F, p3.render = Q), I2 && I2.sub(p3), p3.state || (p3.state = {}), p3.__n = i3, v3 = p3.__d = true, p3.__h = [], p3._sb = []), M && null == p3.__s && (p3.__s = p3.state), M && null != F.getDerivedStateFromProps && (p3.__s == p3.state && (p3.__s = m({}, p3.__s)), m(p3.__s, F.getDerivedStateFromProps(x2, p3.__s))), y3 = p3.props, d3 = p3.state, p3.__v = u4, v3) M && null == F.getDerivedStateFromProps && null != p3.componentWillMount && p3.componentWillMount(), M && null != p3.componentDidMount && p3.__h.push(p3.componentDidMount);
        else {
          if (M && null == F.getDerivedStateFromProps && x2 !== y3 && null != p3.componentWillReceiveProps && p3.componentWillReceiveProps(x2, P2), u4.__v == t3.__v || !p3.__e && null != p3.shouldComponentUpdate && false === p3.shouldComponentUpdate(x2, p3.__s, P2)) {
            u4.__v != t3.__v && (p3.props = x2, p3.state = p3.__s, p3.__d = false), u4.__e = t3.__e, u4.__k = t3.__k, u4.__k.some(function(n3) {
              n3 && (n3.__ = u4);
            }), w.push.apply(p3.__h, p3._sb), p3._sb = [], p3.__h.length && e3.push(p3), f4 = $(t3);
            break n;
          }
          null != p3.componentWillUpdate && p3.componentWillUpdate(x2, p3.__s, P2), M && null != p3.componentDidUpdate && p3.__h.push(function() {
            p3.componentDidUpdate(y3, d3, _2);
          });
        }
        if (p3.context = P2, p3.props = x2, p3.__P = n2, p3.__e = false, A2 = l.__r, H2 = 0, M) p3.state = p3.__s, p3.__d = false, A2 && A2(u4), s3 = p3.render(p3.props, p3.state, p3.context), w.push.apply(p3.__h, p3._sb), p3._sb = [];
        else do {
          p3.__d = false, A2 && A2(u4), s3 = p3.render(p3.props, p3.state, p3.context), p3.state = p3.__s;
        } while (p3.__d && ++H2 < 25);
        p3.state = p3.__s, null != p3.getChildContext && (i3 = m(m({}, i3), p3.getChildContext())), M && !v3 && null != p3.getSnapshotBeforeUpdate && (_2 = p3.getSnapshotBeforeUpdate(y3, d3)), T2 = null != s3 && s3.type === S && null == s3.key ? E(s3.props.children) : s3, f4 = L(n2, g(T2) ? T2 : [T2], u4, t3, i3, r3, o3, e3, f4, c3, a3), p3.base = u4.__e, u4.__u &= -161, p3.__h.length && e3.push(p3), k3 && (p3.__E = p3.__ = null);
      } catch (n3) {
        if (e3.length = h3, u4.__v = null, c3 || null != o3) {
          if (n3.then) {
            for (u4.__u |= c3 ? 160 : 128; f4 && 8 == f4.nodeType && f4.nextSibling; ) f4 = f4.nextSibling;
            null != o3 && (o3[o3.indexOf(f4)] = null), u4.__e = f4;
          } else if (null != o3) for (j3 = o3.length; j3--; ) b(o3[j3]);
        } else u4.__e = t3.__e;
        null == u4.__k && (u4.__k = t3.__k || []), n3.then || B(u4), l.__e(n3, u4, t3);
      }
    } else null == o3 && u4.__v == t3.__v ? (u4.__k = t3.__k, u4.__e = t3.__e) : f4 = u4.__e = G(t3.__e, u4, t3, i3, r3, o3, e3, c3, a3);
    return (s3 = l.diffed) && s3(u4), 128 & u4.__u ? void 0 : f4;
  }
  function B(n2) {
    n2 && (n2.__c && (n2.__c.__e = true), n2.__k && n2.__k.some(B));
  }
  function D(n2, u4, t3) {
    for (var i3 = 0; i3 < t3.length; i3++) J(t3[i3], t3[++i3], t3[++i3]);
    l.__c && l.__c(u4, n2), n2.some(function(u5) {
      try {
        n2 = u5.__h, u5.__h = [], n2.some(function(n3) {
          n3.call(u5);
        });
      } catch (n3) {
        l.__e(n3, u5.__v);
      }
    });
  }
  function E(n2) {
    return "object" != typeof n2 || null == n2 || n2.__b > 0 ? n2 : g(n2) ? n2.map(E) : void 0 !== n2.constructor ? null : m({}, n2);
  }
  function G(u4, t3, i3, r3, o3, e3, f4, c3, a3) {
    var s3, h3, p3, v3, y3, w3, _2, m3 = i3.props || d, k3 = t3.props, x2 = t3.type;
    if ("svg" == x2 ? o3 = "http://www.w3.org/2000/svg" : "math" == x2 ? o3 = "http://www.w3.org/1998/Math/MathML" : o3 || (o3 = "http://www.w3.org/1999/xhtml"), null != e3) {
      for (s3 = 0; s3 < e3.length; s3++) if ((y3 = e3[s3]) && "setAttribute" in y3 == !!x2 && (x2 ? y3.localName == x2 : 3 == y3.nodeType)) {
        u4 = y3, e3[s3] = null;
        break;
      }
    }
    if (null == u4) {
      if (null == x2) return document.createTextNode(k3);
      u4 = document.createElementNS(o3, x2, k3.is && k3), c3 && (l.__m && l.__m(t3, e3), c3 = false), e3 = null;
    }
    if (null == x2) m3 === k3 || c3 && u4.data == k3 || (u4.data = k3);
    else {
      if (e3 = "textarea" == x2 && null != k3.defaultValue ? null : e3 && n.call(u4.childNodes), !c3 && null != e3) for (m3 = {}, s3 = 0; s3 < u4.attributes.length; s3++) m3[(y3 = u4.attributes[s3]).name] = y3.value;
      for (s3 in m3) y3 = m3[s3], "dangerouslySetInnerHTML" == s3 ? p3 = y3 : "children" == s3 || s3 in k3 || "value" == s3 && "defaultValue" in k3 || "checked" == s3 && "defaultChecked" in k3 || N(u4, s3, null, y3, o3);
      for (s3 in k3) y3 = k3[s3], "children" == s3 ? v3 = y3 : "dangerouslySetInnerHTML" == s3 ? h3 = y3 : "value" == s3 ? w3 = y3 : "checked" == s3 ? _2 = y3 : c3 && "function" != typeof y3 || m3[s3] === y3 || N(u4, s3, y3, m3[s3], o3);
      if (h3) c3 || p3 && (h3.__html == p3.__html || h3.__html == u4.innerHTML) || (u4.innerHTML = h3.__html), t3.__k = [];
      else if (p3 && (u4.innerHTML = ""), L("template" == t3.type ? u4.content : u4, g(v3) ? v3 : [v3], t3, i3, r3, "foreignObject" == x2 ? "http://www.w3.org/1999/xhtml" : o3, e3, f4, e3 ? e3[0] : i3.__k && $(i3, 0), c3, a3), null != e3) for (s3 = e3.length; s3--; ) b(e3[s3]);
      c3 && "textarea" != x2 || (s3 = "value", "progress" == x2 && null == w3 ? u4.removeAttribute("value") : null != w3 && (w3 !== u4[s3] || "progress" == x2 && !w3 || "option" == x2 && w3 != m3[s3]) && N(u4, s3, w3, m3[s3], o3), s3 = "checked", null != _2 && _2 != u4[s3] && N(u4, s3, _2, m3[s3], o3));
    }
    return u4;
  }
  function J(n2, u4, t3) {
    try {
      if ("function" == typeof n2) {
        var i3 = "function" == typeof n2.__u;
        i3 && n2.__u(), i3 && null == u4 || (n2.__u = n2(u4));
      } else n2.current = u4;
    } catch (n3) {
      l.__e(n3, t3);
    }
  }
  function K(n2, u4, t3) {
    var i3, r3;
    if (l.unmount && l.unmount(n2), (i3 = n2.ref) && (i3.current && i3.current != n2.__e || J(i3, null, u4)), null != (i3 = n2.__c)) {
      if (i3.componentWillUnmount) try {
        i3.componentWillUnmount();
      } catch (n3) {
        l.__e(n3, u4);
      }
      i3.base = i3.__P = i3.__n = null;
    }
    if (i3 = n2.__k) for (r3 = 0; r3 < i3.length; r3++) i3[r3] && K(i3[r3], u4, t3 || "function" != typeof n2.type);
    t3 || b(n2.__e), n2.__c = n2.__ = n2.__e = void 0;
  }
  function Q(n2, l3, u4) {
    return this.constructor(n2, u4);
  }
  function R(u4, t3, i3) {
    var r3, o3, e3, f4;
    t3 == document && (t3 = document.documentElement), l.__ && l.__(u4, t3), o3 = (r3 = "function" == typeof i3) ? null : i3 && i3.__k || t3.__k, e3 = [], f4 = [], q(t3, u4 = (!r3 && i3 || t3).__k = k(S, null, [u4]), o3 || d, d, t3.namespaceURI, !r3 && i3 ? [i3] : o3 ? null : t3.firstChild ? n.call(t3.childNodes) : null, e3, !r3 && i3 ? i3 : o3 ? o3.__e : t3.firstChild, r3, f4), D(e3, u4, f4), u4.props.children = null;
  }
  n = w.slice, l = { __e: function(n2, l3, u4, t3) {
    for (var i3, r3, o3; l3 = l3.__; ) if ((i3 = l3.__c) && !i3.__) try {
      if ((r3 = i3.constructor) && null != r3.getDerivedStateFromError && (i3.setState(r3.getDerivedStateFromError(n2)), o3 = i3.__d), null != i3.componentDidCatch && (i3.componentDidCatch(n2, t3 || {}), o3 = i3.__d), o3) return i3.__E = i3;
    } catch (l4) {
      n2 = l4;
    }
    throw n2;
  } }, u = 0, t = function(n2) {
    return null != n2 && void 0 === n2.constructor;
  }, C.prototype.setState = function(n2, l3) {
    var u4;
    u4 = null != this.__s && this.__s != this.state ? this.__s : this.__s = m({}, this.state), "function" == typeof n2 && (n2 = n2(m({}, u4), this.props)), n2 && m(u4, n2), null != n2 && this.__v && (l3 && this._sb.push(l3), A(this));
  }, C.prototype.forceUpdate = function(n2) {
    this.__v && (this.__e = true, n2 && this.__h.push(n2), A(this));
  }, C.prototype.render = S, i = [], o = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n2, l3) {
    return n2.__v.__b - l3.__v.__b;
  }, H.__r = 0, f = Math.random().toString(8), c = "__d" + f, a = "__a" + f, s = /(PointerCapture)$|Capture$/i, h = 0, p = V(false), v = V(true), y = 0;

  // node_modules/preact/hooks/dist/hooks.module.js
  var t2;
  var r2;
  var u2;
  var i2;
  var o2 = 0;
  var f2 = [];
  var c2 = l;
  var e2 = c2.__b;
  var a2 = c2.__r;
  var v2 = c2.diffed;
  var l2 = c2.__c;
  var m2 = c2.unmount;
  var p2 = c2.__;
  function s2(n2, t3) {
    c2.__h && c2.__h(r2, n2, o2 || t3), o2 = 0;
    var u4 = r2.__H || (r2.__H = { __: [], __h: [] });
    return n2 >= u4.__.length && u4.__.push({}), u4.__[n2];
  }
  function d2(n2) {
    return o2 = 1, y2(D2, n2);
  }
  function y2(n2, u4, i3) {
    var o3 = s2(t2++, 2);
    if (o3.t = n2, !o3.__c && (o3.__ = [i3 ? i3(u4) : D2(void 0, u4), function(n3) {
      var t3 = o3.__N ? o3.__N[0] : o3.__[0], r3 = o3.t(t3, n3);
      t3 !== r3 && (o3.__N = [r3, o3.__[1]], o3.__c.setState({}));
    }], o3.__c = r2, !r2.__f)) {
      var f4 = function(n3, t3, r3) {
        if (!o3.__c.__H) return true;
        var u5 = false, i4 = o3.__c.props !== n3;
        if (o3.__c.__H.__.some(function(n4) {
          if (n4.__N) {
            u5 = true;
            var t4 = n4.__[0];
            n4.__ = n4.__N, n4.__N = void 0, t4 !== n4.__[0] && (i4 = true);
          }
        }), c3) {
          var f5 = c3.call(this, n3, t3, r3);
          return u5 ? f5 || i4 : f5;
        }
        return !u5 || i4;
      };
      r2.__f = true;
      var c3 = r2.shouldComponentUpdate, e3 = r2.componentWillUpdate;
      r2.componentWillUpdate = function(n3, t3, r3) {
        if (this.__e) {
          var u5 = c3;
          c3 = void 0, f4(n3, t3, r3), c3 = u5;
        }
        e3 && e3.call(this, n3, t3, r3);
      }, r2.shouldComponentUpdate = f4;
    }
    return o3.__N || o3.__;
  }
  function j2() {
    for (var n2; n2 = f2.shift(); ) {
      var t3 = n2.__H;
      if (n2.__P && t3) try {
        t3.__h.some(z2), t3.__h.some(B2), t3.__h = [];
      } catch (r3) {
        t3.__h = [], c2.__e(r3, n2.__v);
      }
    }
  }
  c2.__b = function(n2) {
    r2 = null, e2 && e2(n2);
  }, c2.__ = function(n2, t3) {
    n2 && t3.__k && t3.__k.__m && (n2.__m = t3.__k.__m), p2 && p2(n2, t3);
  }, c2.__r = function(n2) {
    a2 && a2(n2), t2 = 0;
    var i3 = (r2 = n2.__c).__H;
    i3 && (u2 === r2 ? (i3.__h = [], r2.__h = [], i3.__.some(function(n3) {
      n3.__N && (n3.__ = n3.__N), n3.u = n3.__N = void 0;
    })) : (i3.__h.some(z2), i3.__h.some(B2), i3.__h = [], t2 = 0)), u2 = r2;
  }, c2.diffed = function(n2) {
    v2 && v2(n2);
    var t3 = n2.__c;
    t3 && t3.__H && (t3.__H.__h.length && (1 !== f2.push(t3) && i2 === c2.requestAnimationFrame || ((i2 = c2.requestAnimationFrame) || w2)(j2)), t3.__H.__.some(function(n3) {
      n3.u && (n3.__H = n3.u, n3.u = void 0);
    })), u2 = r2 = null;
  }, c2.__c = function(n2, t3) {
    t3.some(function(n3) {
      try {
        n3.__h.some(z2), n3.__h = n3.__h.filter(function(n4) {
          return !n4.__ || B2(n4);
        });
      } catch (r3) {
        t3.some(function(n4) {
          n4.__h && (n4.__h = []);
        }), t3 = [], c2.__e(r3, n3.__v);
      }
    }), l2 && l2(n2, t3);
  }, c2.unmount = function(n2) {
    m2 && m2(n2);
    var t3, r3 = n2.__c;
    r3 && r3.__H && (r3.__H.__.some(function(n3) {
      try {
        z2(n3);
      } catch (n4) {
        t3 = n4;
      }
    }), r3.__H = void 0, t3 && c2.__e(t3, r3.__v));
  };
  var k2 = "function" == typeof requestAnimationFrame;
  function w2(n2) {
    var t3, r3 = function() {
      clearTimeout(u4), k2 && cancelAnimationFrame(t3), setTimeout(n2);
    }, u4 = setTimeout(r3, 35);
    k2 && (t3 = requestAnimationFrame(r3));
  }
  function z2(n2) {
    var t3 = r2, u4 = n2.__c;
    "function" == typeof u4 && (n2.__c = void 0, u4()), r2 = t3;
  }
  function B2(n2) {
    var t3 = r2;
    n2.__c = n2.__(), r2 = t3;
  }
  function D2(n2, t3) {
    return "function" == typeof t3 ? t3(n2) : t3;
  }

  // web/src/format.ts
  var dollars = (v3) => "$" + Math.round(v3).toLocaleString("en-US");

  // node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js
  var f3 = 0;
  function u3(e3, t3, n2, o3, i3, u4) {
    t3 || (t3 = {});
    var a3, c3, p3 = t3;
    if ("ref" in p3) for (c3 in p3 = {}, t3) "ref" == c3 ? a3 = t3[c3] : p3[c3] = t3[c3];
    var l3 = { type: e3, props: p3, key: n2, ref: a3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: --f3, __i: -1, __u: 0, __source: i3, __self: u4 };
    if ("function" == typeof e3 && (a3 = e3.defaultProps)) for (c3 in a3) void 0 === p3[c3] && (p3[c3] = a3[c3]);
    return l.vnode && l.vnode(l3), l3;
  }

  // web/src/Spark.tsx
  function Spark({ values, w: w3 = 96, h: h3 = 24, title }) {
    const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
    const points = values.map((v3, i3) => `${(i3 / Math.max(1, values.length - 1) * w3).toFixed(1)},${(h3 - 2 - (v3 - lo) / span * (h3 - 4)).toFixed(1)}`).join(" ");
    return /* @__PURE__ */ u3("svg", { class: "spark", viewBox: `0 0 ${w3} ${h3}`, role: title ? "img" : void 0, "aria-label": title, children: /* @__PURE__ */ u3("polyline", { points, fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linejoin": "round", "stroke-linecap": "round" }) });
  }

  // web/src/status/Tiles.tsx
  function Tile({ label, value, sub, tone }) {
    return /* @__PURE__ */ u3("div", { class: "card tile" + (tone ? " " + tone : ""), children: [
      /* @__PURE__ */ u3("div", { class: "label", children: label }),
      /* @__PURE__ */ u3("div", { class: "value", children: value }),
      /* @__PURE__ */ u3("div", { class: "sub", children: sub })
    ] });
  }
  function SavingsTrend({ history }) {
    const pts = history.slice(-90);
    if (pts.length < 2) return /* @__PURE__ */ u3(S, { children: "in subscriptions" });
    const first = pts[0], last = pts[pts.length - 1];
    const delta = last.annual - first.annual;
    const since = (/* @__PURE__ */ new Date(first.date + "T12:00:00")).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(Spark, { values: pts.map((p3) => p3.annual) }),
      /* @__PURE__ */ u3("span", { class: "trend", children: delta === 0 ? `same since ${since}` : `${delta > 0 ? "+" : "−"}${dollars(Math.abs(delta))} since ${since}` })
    ] });
  }
  function PauseButton({ paused, onPause }) {
    const [busy, setBusy] = d2(false);
    const click = async () => {
      setBusy(true);
      try {
        await onPause(!paused);
      } finally {
        setBusy(false);
      }
    };
    return /* @__PURE__ */ u3("button", { class: "small change", disabled: busy, onClick: click, children: paused ? "Resume" : "Pause" });
  }
  var troubled = (a3) => a3.health === "unhealthy" || a3.health === "restarting" || !!a3.notAnswering || a3.state === "missing" || a3.state === "stopped";
  function Tiles({ status: st, history, onPause }) {
    const running = st.apps.filter((a3) => a3.state === "running");
    const trouble = st.apps.filter(troubled);
    const u4 = st.updates;
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(
        Tile,
        {
          label: "Running",
          value: /* @__PURE__ */ u3(S, { children: [
            running.length,
            /* @__PURE__ */ u3("small", { children: [
              " of ",
              st.apps.length
            ] })
          ] }),
          sub: st.missing ? /* @__PURE__ */ u3("span", { class: "bad", children: [
            st.missing,
            " baseline app(s) down"
          ] }) : "All baseline apps are up"
        }
      ),
      /* @__PURE__ */ u3(
        Tile,
        {
          label: "Needs a look",
          value: String(trouble.length),
          tone: trouble.length ? "warn" : "",
          sub: trouble.length ? trouble.slice(0, 3).map((a3) => a3.name).join(", ") + (trouble.length > 3 ? "…" : "") : "Nothing unhealthy or stopped"
        }
      ),
      /* @__PURE__ */ u3(Tile, { label: "Replaces a year", value: st.savings > 0 ? dollars(st.savings) : "$0", sub: /* @__PURE__ */ u3(SavingsTrend, { history }) }),
      /* @__PURE__ */ u3(
        Tile,
        {
          label: "Nightly updates",
          value: u4?.paused ? "Paused" : "On",
          sub: /* @__PURE__ */ u3(S, { children: [
            u4?.paused ? "Until you resume them" : `Run ${u4?.schedule}`,
            /* @__PURE__ */ u3(PauseButton, { paused: !!u4?.paused, onPause })
          ] })
        }
      )
    ] });
  }
  function mountTiles(el, props) {
    R(/* @__PURE__ */ u3(Tiles, { ...props }), el);
  }

  // web/src/status/Usage.tsx
  var keep = 30;
  function record(history, stats) {
    const now = new Set(stats.map((s3) => s3.name));
    for (const name of history.keys()) if (!now.has(name)) history.delete(name);
    for (const s3 of stats) {
      const h3 = history.get(s3.name) || [];
      h3.push(s3.cpu);
      if (h3.length > keep) h3.shift();
      history.set(s3.name, h3);
    }
  }
  function Usage({ stats, history, nameOf }) {
    const busy = stats.filter((s3) => s3.cpu >= 1);
    const total = stats.reduce((t3, s3) => t3 + s3.cpu, 0);
    const most = Math.max(busy[0]?.cpu || 0, 100);
    const heavy = busy.filter((s3) => s3.cpu >= 50);
    const minutes = Math.round((history.get(busy[0]?.name)?.length || 1) * 10 / 60);
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("div", { class: "row", children: [
        /* @__PURE__ */ u3("h2", { children: "What’s using power" }),
        /* @__PURE__ */ u3("span", { class: "muted", title: "Percent of one processor core; 100% is one core kept busy", children: [
          Math.round(total),
          "% of a core in all · ",
          minutes >= 1 ? `live, the last ${minutes} minute${minutes === 1 ? "" : "s"}` : "just now"
        ] })
      ] }),
      /* @__PURE__ */ u3("ul", { class: "alertlist usage", children: busy.slice(0, 6).map((s3) => {
        const past = history.get(s3.name) || [];
        return /* @__PURE__ */ u3("li", { children: [
          /* @__PURE__ */ u3("div", { class: "grow", children: [
            /* @__PURE__ */ u3("strong", { children: nameOf(s3.name) }),
            /* @__PURE__ */ u3("div", { class: "bar", children: /* @__PURE__ */ u3("span", { style: { width: `${Math.max(2, Math.round(s3.cpu / most * 100))}%` } }) })
          ] }),
          past.length >= 3 ? /* @__PURE__ */ u3(Spark, { values: past, w: 72, h: 20, title: `${nameOf(s3.name)}'s use over the last minutes` }) : null,
          /* @__PURE__ */ u3("span", { class: "when", children: [
            Math.round(s3.cpu),
            "%",
            s3.mem ? " · " + s3.mem : ""
          ] })
        ] }, s3.name);
      }) }),
      /* @__PURE__ */ u3("p", { class: "muted", children: heavy.length ? `${heavy.map((s3) => nameOf(s3.name)).join(" and ")} ${heavy.length === 1 ? "is" : "are"} busy. Some apps work hard for a while after you add files (Immich reads new photos); if it lasts, stop what you don’t use. On battery, the battery saver pauses the heaviest apps.` : "Nothing is working hard. On battery, the battery saver pauses the heaviest apps." })
    ] });
  }
  function mountUsage(el, props) {
    el.hidden = !props.stats.some((s3) => s3.cpu >= 1);
    R(el.hidden ? null : /* @__PURE__ */ u3(Usage, { ...props }), el);
  }

  // web/src/app.ts
  var go = () => window.go.main.App;
  var $2 = (id) => document.getElementById(id);
  var $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  var $1 = (sel, root = document) => root.querySelector(sel);
  function h2(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k3, v3] of Object.entries(attrs)) {
      if (k3.startsWith("on")) el.addEventListener(k3.slice(2), v3);
      else if (k3 === "value") el.value = v3;
      else if (v3 === true) el.setAttribute(k3, "");
      else if (v3 !== false && v3 != null) el.setAttribute(k3, v3);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
    if (tag === "a" && attrs.onclick && !attrs.href) keyable(el);
    return el;
  }
  function keyable(el) {
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.addEventListener("keydown", (e3) => {
      if (e3.key === "Enter" || e3.key === " ") {
        e3.preventDefault();
        el.click();
      }
    });
    return el;
  }
  var icons = {
    restart: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    update: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    start: '<polygon points="6 3 20 12 6 21 6 3"/>',
    logs: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    rollback: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    phone: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    photos: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    film: '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'
  };
  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.innerHTML = icons[name];
    return svg;
  }
  var errorTimer = 0;
  function showError(e3) {
    const el = $2("error");
    el.textContent = String(e3 && e3.message || e3);
    el.hidden = false;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => el.hidden = true, 6e3);
  }
  function show(name) {
    $$("nav button").forEach((b2) => {
      b2.classList.toggle("active", b2.dataset.screen === name);
      if (b2.dataset.screen === name) b2.setAttribute("aria-current", "page");
      else b2.removeAttribute("aria-current");
    });
    document.querySelectorAll(".screen").forEach((s3) => s3.classList.toggle("active", s3.id === name));
    if (name === "status") loadStatus();
    if (name === "backups") loadBackups();
    if (name === "setup") {
      loadHost();
      loadSetup();
    }
    if (name === "settings") loadSettings();
  }
  function focusScreen(name) {
    const h1 = $1(`#${name} h1`);
    if (!h1) return;
    h1.tabIndex = -1;
    h1.focus({ preventScroll: true });
  }
  var navigated = false;
  var platform = navigator.platform || navigator.userAgent;
  var osName = /Mac/.test(platform) ? "mac" : /Win/.test(platform) ? "windows" : "linux";
  document.documentElement.classList.add("os-" + osName);
  var isMac = osName === "mac";
  var thisMachine = isMac ? "This Mac" : osName === "windows" ? "This PC" : "This machine";
  var mod = isMac ? "⌘" : "Ctrl+";
  $$("nav button").forEach((b2, i3) => {
    b2.onclick = () => {
      navigated = true;
      show(b2.dataset.screen);
      focusScreen(b2.dataset.screen);
    };
    b2.title = `${b2.textContent.trim()} (${mod}${i3 + 1})`;
  });
  var textSize = 1;
  function setTextSize(z3) {
    textSize = Math.round(Math.min(2, Math.max(0.8, z3)) * 10) / 10;
    document.documentElement.style.setProperty("--zoom", String(textSize));
    try {
      localStorage.setItem("homelab.textSize", String(textSize));
    } catch {
    }
  }
  try {
    const z3 = Number(localStorage.getItem("homelab.textSize"));
    if (z3) setTextSize(z3);
  } catch {
  }
  var screens = ["choose", "status", "backups", "setup", "settings"];
  document.addEventListener("keydown", (e3) => {
    const current = document.querySelector(".screen.active")?.id;
    const target = e3.target;
    if (e3.key === "Escape" && target.matches?.("input[type=search]") && target.value) {
      target.value = "";
      target.dispatchEvent(new Event("input"));
      return;
    }
    if (e3.key === "F1" && !isMac) {
      e3.preventDefault();
      Promise.resolve(go().Open("https://github.com/Snooper42/homelab-wizard/blob/main/docs/Getting%20Started.md")).catch(showError);
      return;
    }
    if (!(isMac ? e3.metaKey : e3.ctrlKey) || e3.altKey) return;
    if (["=", "+", "-", "_", "0"].includes(e3.key)) {
      e3.preventDefault();
      setTextSize(e3.key === "0" ? 1 : textSize + (e3.key === "-" || e3.key === "_" ? -0.1 : 0.1));
      return;
    }
    if (e3.shiftKey) return;
    const n2 = Number(e3.key);
    if (e3.key === ",") {
      e3.preventDefault();
      navigated = true;
      show("settings");
    } else if (n2 >= 1 && n2 <= screens.length) {
      e3.preventDefault();
      navigated = true;
      show(screens[n2 - 1]);
    } else if (e3.key.toLowerCase() === "r") {
      e3.preventDefault();
      if (current) show(current);
    } else if (e3.key.toLowerCase() === "f") {
      const search = { choose: "search", settings: "settingsSearch" }[current];
      if (search) {
        e3.preventDefault();
        $2(search).focus();
        $2(search).select();
      }
    }
  });
  var catalog = null;
  var statusById = {};
  var selected = /* @__PURE__ */ new Set();
  var settings = {};
  var appName = (id) => (catalog.apps.find((a3) => a3.id === id) || { name: id }).name;
  async function loadCatalog() {
    try {
      catalog = await go().Catalog();
    } catch (e3) {
      $2("groups").replaceChildren(h2("p", { class: "bad" }, String(e3)));
      return;
    }
    await loadAppStates();
    fillCategories();
    const toggle = (p3) => () => {
      const on = p3.apps.every((id) => selected.has(id));
      p3.apps.forEach((id) => on ? selected.delete(id) : selected.add(id));
      renderApps();
      replan();
    };
    $2("presets").replaceChildren(...catalog.presets.filter((p3) => !p3.starter && !p3.id.startsWith("stack:")).map((p3) => {
      const chip = h2("button", { class: "chip", title: p3.description || "", onclick: toggle(p3) }, p3.name);
      chip.apps = p3.apps;
      return chip;
    }));
    const starterLooks = { photos: ["photos", "#ff9500"], passwords: ["lock", "#34c759"], movies: ["film", "#ff3b30"], music: ["music", "#ff2d55"], files: ["folder", "#007aff"] };
    const starters = catalog.presets.filter((p3) => p3.starter);
    $2("starterBox").hidden = !starters.length;
    if (!starters.length) $2("more").open = true;
    $2("starters").replaceChildren(...starters.map((p3) => {
      const running = p3.apps.every((id) => statusById[id]?.state === "running");
      const [glyph, tint] = starterLooks[p3.id] || [];
      const card = h2(
        "button",
        { class: "starter", onclick: toggle(p3) },
        glyph ? h2("span", { class: "glyph", style: `--tint:${tint}` }, icon(glyph)) : null,
        h2("strong", {}, p3.name),
        h2("span", { class: "desc" }, p3.description || ""),
        running ? h2("span", { class: "state" }, "Running") : null
      );
      card.apps = p3.apps;
      return card;
    }));
    renderApps();
  }
  async function loadAppStates() {
    try {
      const st = await go().Status();
      statusById = Object.fromEntries(st.apps.map((a3) => [a3.id, a3]));
    } catch {
      statusById = {};
    }
  }
  $2("search").oninput = (e3) => {
    query = e3.target.value.trim().toLowerCase();
    if (query) $2("more").open = true;
    $2("choose").classList.toggle("searching", !!query);
    renderApps();
  };
  function fillCategories() {
    $2("cCategory").replaceChildren(...catalog.categories.map((c3) => h2("option", { value: c3.id }, c3.label)));
    $2("cCategory").value = "documents";
  }
  $2("cAdd").onclick = async () => {
    const log = $2("cLog");
    const spec = {
      id: "",
      // the Go side makes it from the name
      name: $2("cName").value.trim(),
      image: $2("cImage").value.trim(),
      port: Number($2("cPort").value) || 0,
      category: $2("cCategory").value,
      description: $2("cDesc").value.trim(),
      volumes: $2("cVolumes").value.split(",").map((v3) => v3.trim()).filter(Boolean),
      env: {}
    };
    log.hidden = false;
    log.textContent = "";
    $2("cAdd").disabled = true;
    const off = window.runtime.EventsOn("cli:log", (line) => {
      log.textContent += line + "\n";
    });
    try {
      const before = new Set(catalog.apps.map((a3) => a3.id));
      catalog = await go().AddCustom(spec);
      const added = catalog.apps.find((a3) => !before.has(a3.id));
      renderApps();
      if (added) {
        selected.add(added.id);
        renderApps();
        replan();
      }
      for (const id of ["cName", "cImage", "cPort", "cDesc", "cVolumes"]) $2(id).value = "";
    } catch (e3) {
      showError(e3);
    } finally {
      if (typeof off === "function") off();
      $2("cAdd").disabled = false;
    }
  };
  var query = "";
  var matches = (a3) => !query || [a3.name, a3.id, a3.description, ...a3.replaces || [], ...a3.aliases || []].join(" ").toLowerCase().includes(query);
  function renderApps() {
    const byCategory = {};
    for (const a3 of catalog.apps) if (a3.kind !== "helper" && matches(a3)) (byCategory[a3.category] ??= []).push(a3);
    if (query && !Object.keys(byCategory).length) {
      $2("groups").replaceChildren(h2("p", { class: "muted empty" }, `No app matches “${query}”. Add your own below.`));
      markPresets();
      return;
    }
    $2("groups").replaceChildren(...catalog.categories.filter((c3) => byCategory[c3.id]).map((c3) => {
      const running = byCategory[c3.id].filter((a3) => statusById[a3.id]?.state === "running").length;
      return h2("div", { class: "group" }, h2("h2", {}, c3.label, h2("span", { class: "n" }, `${running} of ${byCategory[c3.id].length} running`)), byCategory[c3.id].map(appRow));
    }));
    markPresets();
  }
  function markPresets() {
    for (const chip of [...$2("presets").children, ...$2("starters").children]) chip.classList.toggle("on", !!chip.apps?.length && chip.apps.every((id) => selected.has(id)));
  }
  var stateBadge = { running: ["running", "ok"], stopped: ["stopped", "warn"], elsewhere: ["runs elsewhere", "warn"] };
  function appRow(a3) {
    const native = a3.kind === "native";
    const st = statusById[a3.id];
    const box = h2("input", {
      type: "checkbox",
      checked: selected.has(a3.id),
      disabled: native,
      onchange: (e3) => {
        e3.target.checked ? selected.add(a3.id) : selected.delete(a3.id);
        markPresets();
        replan();
      }
    });
    const [stateText, stateCls] = st && stateBadge[st.state] || [];
    const target = st?.state === "running" ? st.address ? "https://" + st.address : st.url : "";
    const quiet = (fn) => (e3) => {
      e3.preventDefault();
      e3.stopPropagation();
      fn();
    };
    const links = [
      target ? h2("a", { onclick: quiet(() => go().Open(target)) }, "Open") : null,
      a3.inputs?.length ? h2("a", { onclick: quiet(() => showSettings(a3.inputs)) }, "Settings") : null
    ].filter(Boolean);
    return h2(
      "label",
      { class: "app" },
      box,
      h2(
        "div",
        { class: "grow" },
        h2("strong", {}, a3.name),
        native ? h2("span", { class: "badge" }, "runs natively") : null,
        stateText ? h2("span", { class: "badge " + stateCls }, stateText) : null,
        h2("div", { class: "desc" }, a3.description),
        a3.replaces?.length ? h2("div", { class: "replaces" }, "Replaces " + a3.replaces.join(", ")) : null
      ),
      links.length ? h2("div", { class: "links-inline" }, links) : null
    );
  }
  var planSeq = 0;
  var replanTimer = 0;
  function replan() {
    clearTimeout(replanTimer);
    replanTimer = setTimeout(doPlan, 250);
  }
  var filled = () => Object.fromEntries(Object.entries(settings).filter(([, v3]) => v3 !== ""));
  async function doPlan() {
    const seq = ++planSeq;
    const tokens = [...selected];
    if (tokens.length && !installing) {
      $2("progress").replaceChildren();
      $2("started").replaceChildren();
      $2("wiring").replaceChildren();
      $2("installLog").textContent = "";
      $2("installLog").parentElement.hidden = true;
    }
    if (!tokens.length) {
      $2("plan").replaceChildren("Nothing selected yet. Pick something to start with, or tick an app.");
      $2("installBtn").disabled = true;
      return;
    }
    let p3;
    try {
      p3 = await go().Plan(tokens, filled());
    } catch (e3) {
      if (seq === planSeq) {
        $2("plan").replaceChildren(h2("p", { class: "bad" }, String(e3)));
        $2("installBtn").disabled = true;
      }
      return;
    }
    if (seq !== planSeq) return;
    renderPlan(p3);
    renderInputs(p3);
    const wireable = new Set(catalog.wireable || []);
    $2("wireRow").hidden = ![...p3.start, ...selected].some((id) => wireable.has(id));
    $2("installBtn").disabled = !(p3.ready && p3.start.length);
  }
  var list = (title, items, cls = "") => items.length ? [h2("h2", {}, title), h2("ul", { class: cls }, items.map((i3) => h2("li", {}, i3)))] : [];
  var plural = (n2, one, many) => `${n2} ${n2 === 1 ? one : many}`;
  function renderPlan(p3) {
    const picked = p3.start.filter((id) => !p3.added[id]);
    const helpers = p3.start.filter((id) => p3.added[id]);
    const running = p3.skips.filter((s3) => /^already running/.test(s3.reason));
    const quiet = p3.skips.filter((s3) => /^only needed by/.test(s3.reason));
    const needs = p3.skips.filter((s3) => !running.includes(s3) && !quiet.includes(s3));
    const lead = picked.length ? `Installs ${plural(picked.length, "app", "apps")}` + (helpers.length ? `, with ${plural(helpers.length, "helper", "helpers")} they need` : "") + "." : "";
    const details = [
      ...list("Helpers that start with them", helpers.map((id) => `${appName(id)} (for ${appName(p3.added[id])})`)),
      ...list("Port changes", p3.portChanges.map((c3) => `${c3.var}: ${c3.from} → ${c3.to} (${c3.reason})`)),
      ...list("Settings written", p3.envChanges.map((c3) => c3.secret ? `${c3.key} (hidden)` : `${c3.key} = ${c3.value}`))
    ];
    $2("plan").replaceChildren(
      lead ? h2("p", { class: "planLead" }, lead) : "",
      picked.length ? h2("ul", { class: "ok planApps" }, picked.map((id) => h2("li", {}, appName(id)))) : "",
      ...list("Waiting for a setting", needs.map((s3) => h2("span", {}, h2("strong", {}, appName(s3.app)), ": ", friendlyReason(s3.reason))), "warn"),
      ...list("Problems", p3.problems, "bad"),
      ...list("Worth knowing", p3.warnings, "warn"),
      running.length ? h2("p", { class: "muted small" }, `Already running: ${running.map((s3) => appName(s3.app)).join(", ")}.`) : "",
      details.length ? h2("details", { class: "planDetails" }, h2("summary", { class: "muted" }, "Details"), ...details) : ""
    );
    if (!p3.start.length) {
      const why = needs.length ? "Fill in the settings below to install the rest." : "Nothing left to install: everything you picked is already running.";
      $2("plan").append(h2("p", { id: "nothingToInstall", class: "muted" }, why));
    }
  }
  function friendlyReason(r3) {
    return r3.replace(/set ([A-Z0-9_]+(?:(?:, | and | or )[A-Z0-9_]+)*) in \.env first/g, (_2, keys) => "fill in " + keys.split(/, | and | or /).map(settingLabel).join(" and ") + " below");
  }
  var inputKeys = "";
  var settingHelp = null;
  async function renderInputs(p3) {
    const ids = /* @__PURE__ */ new Set([...selected, ...p3.start, ...p3.skips.map((s3) => s3.app)]);
    const keys = [...new Set(catalog.apps.filter((a3) => ids.has(a3.id)).flatMap((a3) => a3.inputs || []))];
    if (keys.join() === inputKeys) return;
    inputKeys = keys.join();
    if (keys.length && !settingHelp) {
      try {
        settingHelp = Object.fromEntries((await go().Settings()).map((s3) => [s3.key, s3]));
      } catch {
        settingHelp = {};
      }
    }
    $2("inputs").replaceChildren(...keys.length ? [h2("h2", {}, "Settings they need")] : [], ...keys.map((k3) => {
      const meta = settingHelp?.[k3] || {};
      const secret = meta.secret ?? /KEY|TOKEN|PASS|SECRET/.test(k3);
      return h2(
        "label",
        { class: "field" },
        h2("span", { class: "fieldName" }, settingLabel(k3)),
        h2("input", {
          type: secret ? "password" : "text",
          value: settings[k3] || "",
          autocomplete: "off",
          spellcheck: "false",
          placeholder: meta.set ? "set already · leave empty to keep it" : "not set yet",
          oninput: (e3) => {
            settings[k3] = e3.target.value;
            replan();
          }
        }),
        meta.help ? h2("span", { class: "help" }, meta.help) : null
      );
    }));
  }
  var installing = false;
  $2("installBtn").onclick = async () => {
    const btn = $2("installBtn");
    installing = true;
    btn.disabled = true;
    btn.textContent = "Installing…";
    $2("progress").replaceChildren();
    $2("started").replaceChildren();
    $2("wiring").replaceChildren();
    const rows = {};
    const names = { env: "Write settings (.env)", folders: "Create folders", networks: "Create networks" };
    const ilog = $2("installLog");
    ilog.textContent = "";
    ilog.parentElement.hidden = true;
    const offLog = window.runtime.EventsOn("install:log", (line) => {
      ilog.parentElement.hidden = false;
      ilog.textContent += line + "\n";
      ilog.scrollTop = ilog.scrollHeight;
    });
    const off = window.runtime.EventsOn("progress", (ev) => {
      const label = ev.name === "start" ? `Start ${(ev.apps || []).map(appName).join(", ")}` : names[ev.name];
      const li = rows[ev.step] || (rows[ev.step] = $2("progress").appendChild(h2("li")));
      li.className = ev.error ? "failed" : ev.done ? "done" : "";
      li.textContent = label + (ev.error ? ` failed: ${ev.error}` : ev.done ? " ✓" : " …");
    });
    try {
      const started = await go().Install([...selected], filled());
      $2("started").replaceChildren(h2("h2", {}, "Started"), started.length ? h2("ul", {}, started.map((s3) => h2("li", {}, s3.url ? h2("a", { onclick: () => go().Open(s3.url) }, s3.name) : s3.name))) : h2("p", { class: "muted" }, "Nothing new to start."));
      if (!$2("wireRow").hidden && $2("wire").checked && started.length) await wire($2("wiring"));
      selected.clear();
      await loadAppStates();
      renderApps();
    } catch (e3) {
      showError(e3);
    } finally {
      if (typeof off === "function") off();
      if (typeof offLog === "function") offLog();
      btn.textContent = "Install";
      installing = false;
      replan();
    }
  };
  var linkMark = { done: ["✓", "ok"], already: ["✓", "ok"], manual: ["!", "warn"], failed: ["✗", "bad"] };
  async function wire(box) {
    const list2 = h2("ul", { class: "links" });
    box.replaceChildren(h2("h2", {}, "Connected for you"), h2("p", { class: "muted" }, "Connecting… this can take a minute while new apps start."), list2);
    const off = window.runtime.EventsOn("link", (l3) => {
      const [mark, cls] = linkMark[l3.state] || ["•", "muted"];
      list2.append(h2("li", {}, h2("span", { class: cls }, mark + " "), l3.text, l3.detail ? h2("span", { class: "detail" }, l3.detail) : null));
    });
    try {
      const links = await go().Wire();
      box.children[1].textContent = links.length ? "" : "Nothing to connect: none of the apps it links is running.";
    } catch (e3) {
      showError(e3);
    } finally {
      if (typeof off === "function") off();
    }
  }
  $2("connect").onclick = () => wire($2("statusWiring"));
  var link = (url, text) => h2("a", { onclick: () => go().Open(url) }, text);
  function startStopped(g2) {
    const stopped = g2.apps.filter((a3) => a3.state === "stopped" && !a3.waitingFor && !batteryPaused.has(a3.id) && catalog?.apps.find((c3) => c3.id === a3.id)?.kind !== "native");
    if (!stopped.length || document.documentElement.classList.contains("companion")) return null;
    return h2("button", { class: "small startall", title: "Start " + stopped.map((a3) => a3.name).join(", "), onclick: async (e3) => {
      e3.stopPropagation();
      e3.target.disabled = true;
      for (const [i3, a3] of stopped.entries()) {
        e3.target.textContent = `Starting ${i3 + 1} of ${stopped.length}…`;
        try {
          await go().AppAction(a3.id, "start");
        } catch (err) {
          showError(err);
          break;
        }
      }
      loadStatus();
    } }, stopped.length === 1 ? "Start it" : `Start the ${stopped.length} stopped`);
  }
  var batteryPaused = /* @__PURE__ */ new Set();
  function stateOf(a3) {
    if (a3.state !== "running" && batteryPaused.has(a3.id)) return ["warn", "Paused on battery"];
    if (a3.state === "stopped" && a3.waitingFor) return ["warn", `Waiting for the ${a3.waitingFor.replace(/^\/Volumes\//, "")} drive`];
    if (a3.state === "running") {
      if (a3.health === "unhealthy") return ["bad", "Unhealthy"];
      if (a3.health === "restarting") return ["bad", "Restarting"];
      if (a3.health === "starting") return ["warn", "Starting"];
      if (a3.notAnswering) return ["bad", `Not answering: ${a3.notAnswering}`];
      return ["ok", a3.health === "native" ? "Running (native app)" : "Running"];
    }
    return { stopped: ["warn", "Stopped"], missing: ["bad", "Not running"], elsewhere: ["warn", "Runs elsewhere"], "not running": ["warn", "Not running"] }[a3.state] || ["", a3.state];
  }
  var weekUp = {};
  function uptime(a3) {
    if (a3.state !== "running" || !a3.since) return null;
    const week = weekUp[a3.id];
    const mins = Math.max(0, Math.round((Date.now() - new Date(a3.since).getTime()) / 6e4)), hours = Math.round(mins / 60);
    const up = mins < 60 ? mins <= 1 ? "up a minute" : `up ${mins} minutes` : hours < 48 ? hours === 1 ? "up an hour" : `up ${hours} hours` : `up ${Math.round(hours / 24)} days`;
    return [
      h2("span", { class: "local" }, up),
      a3.restarts ? h2("span", { class: "badge warn", title: "Docker restarted it after it stopped on its own; its log says why" }, `restarted ${a3.restarts}×`) : null,
      a3.held ? h2("span", { class: "badge", title: `Left out of nightly updates after a rollback; homelab updates release ${a3.id} puts it back` }, "updates held") : null,
      week !== void 0 && week < 0.99 ? h2("span", { class: "badge warn", title: "The share of the watchdog’s checks (every 15 minutes) it passed in the last 7 days" }, `${Math.floor(week * 1e3) / 10}% up this week`) : null
    ];
  }
  function tile(label, value, sub, tone) {
    return h2("div", { class: "card tile" + (tone ? " " + tone : "") }, h2("div", { class: "label" }, label), h2("div", { class: "value" }, value), h2("div", { class: "sub" }, sub));
  }
  var savingsHistory = [];
  async function loadSavingsHistory() {
    try {
      savingsHistory = await go().SavingsHistory() || [];
    } catch {
      savingsHistory = [];
    }
  }
  function renderTiles(st) {
    const trouble = st.apps.filter(troubled);
    mountTiles($2("tiles"), {
      status: st,
      history: savingsHistory,
      onPause: async (paused) => {
        try {
          await go().SetUpdatesPaused(paused);
        } catch (err) {
          showError(err);
        }
        await loadStatus();
      }
    });
    const n2 = trouble.length;
    $2("statusCount").textContent = n2 ? String(n2) : "";
    $2("fixIt").hidden = !(st.missing || st.apps.some((a3) => a3.health === "unhealthy" || a3.health === "restarting" || a3.notAnswering));
  }
  var statusFold = {};
  var statusOpenAll = false;
  var lastStatusOpen = {};
  try {
    const v3 = localStorage.getItem("homelab.statusOpen");
    if (v3 === "all") statusOpenAll = true;
    else if (v3) {
      const kept = JSON.parse(v3);
      statusFold = Array.isArray(kept) ? Object.fromEntries(kept.map((l3) => [l3, true])) : kept;
    }
  } catch {
  }
  function saveStatusOpen() {
    try {
      localStorage.setItem("homelab.statusOpen", statusOpenAll ? "all" : JSON.stringify(statusFold));
    } catch {
    }
  }
  function toggleStatusGroup(label) {
    if (statusOpenAll) {
      statusOpenAll = false;
      statusFold = Object.fromEntries(Object.keys(lastStatusOpen).map((l3) => [l3, true]));
    }
    statusFold[label] = !lastStatusOpen[label];
    saveStatusOpen();
    loadStatus();
  }
  $2("statusAll").onclick = () => {
    statusOpenAll = !statusOpenAll;
    statusFold = {};
    saveStatusOpen();
    loadStatus();
  };
  async function loadStatus() {
    try {
      const st = await go().Status();
      statusById = Object.fromEntries(st.apps.map((a3) => [a3.id, a3]));
      batteryPaused = new Set(st.batteryPaused || []);
      if (!savingsHistory.length) await loadSavingsHistory();
      renderTiles(st);
      await loadWatchdog();
      if (Date.now() - protectionAt > 6e4) loadProtection();
      loadAlerts();
      loadStorage();
      loadUsage();
      loadWeek();
      $2("statusRows").closest("table").hidden = false;
      const trouble = (a3) => a3.health === "unhealthy" || a3.health === "restarting" || a3.state === "missing";
      const catOf = Object.fromEntries((catalog?.apps || []).map((x2) => [x2.id, x2.category]));
      const groups = [
        { label: "Needs a look", apps: st.apps.filter(trouble), alert: true },
        ...(catalog?.categories || []).map((c3) => ({ label: c3.label, apps: st.apps.filter((a3) => !trouble(a3) && catOf[a3.id] === c3.id) })),
        { label: "Other", apps: st.apps.filter((a3) => !trouble(a3) && !(catalog?.categories || []).some((c3) => c3.id === catOf[a3.id])) }
      ].filter((g2) => g2.apps.length);
      const row = (a3) => {
        const [cls, words] = stateOf(a3);
        return h2(
          "tr",
          {},
          h2("td", {}, h2("strong", {}, a3.name)),
          h2("td", { class: "state" }, h2("span", { class: "dot " + cls }), words, a3.state === "elsewhere" ? [h2("span", { class: "local" }, "container " + a3.container), h2("button", { class: "small", onclick: () => cliFlow(`Move ${a3.name} into the homelab`, "adopt", a3.id, "Move it") }, "Move in")] : uptime(a3)),
          // One address: the app's own name when it has one (its address on
          // this machine is in the tooltip), else the local one.
          h2("td", { title: a3.address && a3.url ? "On this machine: " + a3.url : "" }, a3.address ? link("https://" + a3.address, a3.address) : a3.url ? link(a3.url, a3.url.replace(/^http:\/\//, "")) : h2("span", { class: "muted" }, "—")),
          h2("td", { class: "rowActions" }, appActions(a3))
        );
      };
      const fine = (g2) => !g2.alert && g2.apps.every((a3) => a3.state === "running");
      const isOpen = (g2) => statusOpenAll || (g2.label in statusFold ? statusFold[g2.label] : !fine(g2));
      lastStatusOpen = Object.fromEntries(groups.map((g2) => [g2.label, isOpen(g2)]));
      $2("statusRows").replaceChildren(...groups.flatMap((g2) => {
        const open = isOpen(g2);
        const running = g2.apps.filter((a3) => a3.state === "running").length;
        const head = h2(
          "tr",
          {
            class: "grouphead fold" + (g2.alert ? " bad" : ""),
            "aria-expanded": String(open),
            tabindex: 0,
            onclick: () => toggleStatusGroup(g2.label),
            onkeydown: (e3) => {
              if (e3.key === "Enter" || e3.key === " ") {
                e3.preventDefault();
                toggleStatusGroup(g2.label);
              }
            }
          },
          h2(
            "th",
            { colspan: 4 },
            h2("span", { class: "chev" }, open ? "▾" : "▸"),
            g2.label,
            h2("span", { class: "n" }, g2.alert ? String(g2.apps.length) : running === g2.apps.length ? `${running} running ✓` : `${running} of ${g2.apps.length} running`),
            startStopped(g2),
            !open ? h2("span", { class: "names" }, g2.apps.map((a3) => a3.name).join(" · ")) : null
          )
        );
        return [head, ...open ? g2.apps.map(row) : []];
      }));
      $2("statusAll").textContent = statusOpenAll ? "Fold them again" : "Show every app";
      const waiting = [...new Set(st.apps.filter((a3) => a3.state === "stopped" && a3.waitingFor).map((a3) => a3.waitingFor.replace(/^\/Volumes\//, "")))];
      $2("statusNote").textContent = [
        waiting.length ? `Plug in ${waiting.join(" and ")}: the apps waiting for ${waiting.length === 1 ? "it" : "them"} start within 15 minutes of ${waiting.length === 1 ? "it" : "them"} appearing.` : "",
        batteryPaused.size ? `On battery: ${batteryPaused.size} app${batteryPaused.size === 1 ? "" : "s"} paused until this computer is plugged in (Settings › Battery saver).` : "",
        st.unmatched ? `${st.unmatched} other container(s) on this machine are not catalog apps.` : ""
      ].filter(Boolean).join(" ");
    } catch (e3) {
      $2("statusRows").replaceChildren();
      $2("statusRows").closest("table").hidden = true;
      $2("tiles").replaceChildren();
      $2("alertsCard").hidden = true;
      $2("watchCard").hidden = true;
      $2("protectCard").hidden = true;
      protectionAt = 0;
      const msg = String(e3 && e3.message || e3);
      $2("statusNote").replaceChildren(h2(
        "div",
        { class: "card notice" },
        h2("strong", {}, /not running/.test(msg) ? "The container runtime is not running" : "Status is not available"),
        h2("div", { class: "muted" }, msg),
        h2("div", { class: "muted" }, "Every app runs inside it, so they are all paused until it starts. This page checks again every 10 seconds.")
      ));
    }
  }
  async function loadWatchdog() {
    const card = $2("watchCard");
    let w3;
    try {
      w3 = await go().Watchdog();
    } catch {
      card.hidden = true;
      return;
    }
    weekUp = w3.week || {};
    card.hidden = false;
    const title = h2("h2", {}, "Watchdog");
    if (never(w3.lastRun)) {
      card.replaceChildren(h2(
        "div",
        { class: "row" },
        title,
        h2("span", { class: "muted" }, "It checks every app, address, and backup every 15 minutes once the jobs are installed. ", h2("a", { onclick: () => {
          navigated = true;
          show("setup");
        } }, "Open Setup"))
      ));
      return;
    }
    const failing = w3.failing || [];
    const late = Date.now() - new Date(w3.lastRun).getTime() > 45 * 6e4;
    card.replaceChildren(
      h2("div", { class: "row" }, title, h2(
        "span",
        {},
        failing.length ? h2("span", { class: "bad" }, `${failing.length} of ${w3.checks} checks failing`) : h2("span", { class: "ok" }, `✓ All ${w3.checks} checks passed`),
        h2("span", { class: "muted" }, `${w3.pending && !failing.length ? `, ${w3.pending} checked again next run` : ""} · ${ago(w3.lastRun)}`)
      )),
      late ? h2("div", { class: "muted more" }, `It has not run since ${ago(w3.lastRun)}. Setup › Install the jobs schedules it every 15 minutes.`) : "",
      failing.length ? h2(
        "div",
        { class: "row more" },
        h2("span", { class: "muted" }, "Fix it restarts what is down or unwell and reconnects what dropped; it shows the plan first."),
        h2("button", { id: "watchFix", class: "small", onclick: () => cliFlow("Fix it", "fix", "", "Fix these") }, "Fix it")
      ) : "",
      failing.length ? h2("ul", { class: "alertlist" }, failing.map((f4) => h2(
        "li",
        {},
        h2("span", { class: "dot bad" }),
        h2("div", { class: "grow" }, h2("strong", {}, f4.name), f4.problem ? h2("div", { class: "muted" }, f4.problem) : null),
        h2("span", { class: "when muted", title: "Failing since" }, ago(f4.since))
      ))) : ""
    );
  }
  var protectionAt = 0;
  async function loadProtection() {
    protectionAt = Date.now();
    const card = $2("protectCard");
    let p3;
    try {
      p3 = await go().Protection();
    } catch {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    const recent = p3.recent || [];
    const week = p3.week === 1 ? "1 attack caught this week" : `${p3.week} caught this week`;
    card.replaceChildren(
      h2("div", { class: "row" }, h2("h2", {}, "Protection"), h2(
        "span",
        {},
        p3.enforced ? h2("span", { class: "ok" }, "✓ Bans enforced") : h2("span", { class: "bad" }, "Bans not enforced"),
        h2("span", { class: "muted" }, ` · ${p3.week ? week : "nothing caught this week"}${p3.bannedNow ? ` · ${p3.bannedNow} banned now` : ""}`)
      )),
      p3.enforced ? "" : h2(
        "div",
        { class: "row more" },
        h2("span", { class: "muted", title: p3.bouncer }, "The proxy is not getting CrowdSec's ban list, so new attackers are not blocked."),
        h2("button", { id: "protectFix", class: "small", title: "Reconnects the proxy to CrowdSec (both restart for a moment); shows the plan first", onclick: () => cliFlow("Fix it", "fix", "", "Fix these") }, "Fix")
      ),
      recent.length ? h2("ul", { class: "alertlist" }, recent.slice(0, 3).map((a3) => h2(
        "li",
        {},
        h2("span", { class: "dot " + (a3.banned ? "bad" : "") }),
        h2(
          "div",
          { class: "grow" },
          h2("strong", {}, a3.scenario),
          h2("div", { class: "muted" }, [a3.ip, a3.country, a3.network].filter(Boolean).join(" · "))
        ),
        a3.banned ? h2("span", { class: "badge" }, "Banned") : null,
        h2("span", { class: "when muted" }, ago(a3.when))
      ))) : ""
    );
  }
  function bytesText(n2) {
    const units = ["bytes", "KB", "MB", "GB", "TB"];
    let i3 = 0;
    while (n2 >= 1e3 && i3 < units.length - 1) {
      n2 /= 1e3;
      i3++;
    }
    return `${i3 ? n2.toFixed(n2 < 10 ? 1 : 0) : n2} ${units[i3]}`;
  }
  async function loadStorage() {
    const card = $2("storageCard");
    let rec;
    try {
      rec = await go().Storage();
    } catch {
      rec = null;
    }
    const people = (rec?.photos || []).filter((p3) => p3.bytes > 0);
    const folders = (rec?.apps || []).filter((f4) => f4.bytes > 0);
    card.hidden = !people.length && !folders.length;
    if (card.hidden) return;
    const nameOf = (id) => catalog?.apps.find((a3) => a3.id === id)?.name || id;
    const bars = (rows) => {
      const most = rows[0].bytes;
      return h2("ul", { class: "alertlist usage" }, rows.map((r3) => h2(
        "li",
        {},
        h2("div", { class: "grow" }, h2("strong", {}, r3.label), h2("div", { class: "bar" }, h2("span", { style: `width:${Math.max(2, Math.round(r3.bytes / most * 100))}%` }))),
        h2("span", { class: "when" }, bytesText(r3.bytes))
      )));
    };
    const total = (rows) => rows.reduce((t3, r3) => t3 + r3.bytes, 0);
    card.replaceChildren(
      ...people.length ? [
        h2("div", { class: "row" }, h2("h2", {}, "Photos per person"), h2("span", { class: "muted" }, `${bytesText(total(people))} in Immich · ${ago(rec.when)}`)),
        bars(people.map((p3) => ({ label: p3.name, bytes: p3.bytes })))
      ] : [],
      ...folders.length ? [
        h2("div", { class: "row" }, h2("h2", {}, "What the apps keep"), h2("span", { class: "muted", title: "Each app’s folder in data/appdata, measured by the nightly backup; photos and media on their own drive are not counted" }, `${bytesText(total(folders))} of app data · ${ago(rec.when)}`)),
        bars(folders.slice(0, 6).map((f4) => ({ label: nameOf(f4.app), bytes: f4.bytes })))
      ] : []
    );
  }
  var usageAt = 0;
  async function loadUsage() {
    if (Date.now() - usageAt < 9e3) return;
    usageAt = Date.now();
    let stats;
    try {
      stats = await go().Usage();
    } catch {
      stats = [];
    }
    record(usageHistory, stats);
    mountUsage($2("usageCard"), { stats, history: usageHistory, nameOf: (id) => catalog?.apps.find((a3) => a3.id === id)?.name || id });
  }
  var usageHistory = /* @__PURE__ */ new Map();
  setInterval(() => {
    if (!document.hidden && $2("status").classList.contains("active")) loadUsage();
  }, 1e4);
  var weekAt = 0;
  async function loadWeek() {
    if (Date.now() - weekAt < 6e5) return;
    weekAt = Date.now();
    const card = $2("weekCard");
    let w3;
    try {
      w3 = await go().Weekly();
    } catch {
      card.hidden = true;
      return;
    }
    const lines = w3.body.split("\n").filter(Boolean);
    card.hidden = !lines.length;
    card.replaceChildren(
      h2("div", { class: "row" }, h2("h2", {}, "This week"), h2("span", { class: w3.problems ? "warn" : "ok" }, w3.problems ? `${w3.problems} thing${w3.problems === 1 ? "" : "s"} to look at` : "✓ All well")),
      h2("ul", { class: "alertlist week" }, lines.map((l3) => {
        const ok = l3.startsWith("✓");
        return h2("li", {}, h2("span", { class: "dot " + (ok ? "ok" : "warn") }), h2("div", { class: "grow" }, l3.replace(/^[\u2713\u2022]\s*/, "")));
      })),
      h2("p", { class: "muted" }, "The same summary reaches your phone on Sundays once alerts are set up.")
    );
  }
  var topicName = { watchtower: "Updates", "duplicati-alerts": "Backups", "uptime-kuma": "Uptime Kuma", "tunnel-watchdog": "Watchdog" };
  async function loadAlerts() {
    const card = $2("alertsCard");
    let events;
    try {
      events = await go().Alerts();
    } catch (e3) {
      const msg = String(e3 && e3.message || e3);
      card.hidden = false;
      card.replaceChildren(h2(
        "div",
        { class: "row" },
        h2("h2", {}, "Recent alerts"),
        /NTFY_READ_TOKEN/.test(msg) ? h2("span", { class: "muted" }, "They appear here once the alert token is set up. ", h2("a", { onclick: () => {
          navigated = true;
          show("setup");
        } }, "Open Setup")) : h2("span", { class: "muted" }, msg)
      ));
      return;
    }
    card.hidden = false;
    if (!events?.length) {
      card.replaceChildren(h2("div", { class: "row" }, h2("h2", {}, "Recent alerts"), h2("span", { class: "ok" }, "✓ None in the last 12 hours")));
      return;
    }
    const shown = events.slice(0, 5);
    card.replaceChildren(
      h2("div", { class: "row" }, h2("h2", {}, "Recent alerts"), h2("span", { class: "muted" }, `${events.length} in the last 12 hours`)),
      h2("ul", { class: "alertlist" }, shown.map((e3) => h2(
        "li",
        {},
        h2("span", { class: "dot " + (e3.priority >= 4 ? "bad" : (e3.tags || []).includes("white_check_mark") || /^recovered/i.test(e3.title || "") ? "ok" : "") }),
        h2("div", { class: "grow" }, h2("strong", {}, e3.title || e3.message), e3.title && e3.message ? h2("div", { class: "muted" }, e3.message) : null),
        h2("span", { class: "badge" }, topicName[e3.topic] || e3.topic),
        h2("span", { class: "when muted" }, ago(e3.time))
      ))),
      events.length > shown.length ? h2("div", { class: "muted more" }, `and ${events.length - shown.length} more in the ntfy app`) : ""
    );
  }
  function appActions(a3) {
    const entry = catalog?.apps.find((c3) => c3.id === a3.id), kind = entry?.kind;
    if (kind === "native") {
      const title = isMac ? `Open ${a3.name}; it then keeps running in the menu bar` : osName === "windows" ? `Start ${a3.name} (Windows asks for approval)` : `Start ${a3.name}'s service (asks for your password)`;
      return entry?.macApp && a3.state !== "running" ? [h2("button", { class: "small", title, onclick: (e3) => {
        e3.target.disabled = true;
        go().OpenNativeApp(a3.id).then(() => setTimeout(loadStatus, 3e3), (err) => {
          e3.target.disabled = false;
          showError(err);
        });
      } }, isMac ? "Open" : "Start")] : [];
    }
    if (a3.state === "elsewhere") return [];
    if (a3.state === "missing") return [h2("button", { class: "small", onclick: () => {
      selected.add(a3.id);
      navigated = true;
      show("choose");
      renderApps();
      replan();
    } }, "Install")];
    const btn = (action, title, extra = "") => h2("button", { class: "iconbtn " + extra, title, "aria-label": title, onclick: () => runAppAction(a3, action) }, icon(action));
    const logs = h2("button", { class: "iconbtn", title: "Logs", "aria-label": "Logs", onclick: () => showLogs(a3) }, icon("logs"));
    const back = a3.updatedAt ? btn("rollback", `Roll back: the version it ran before its update ${ago(a3.updatedAt)}, and hold its updates`) : null;
    const onPhone = a3.address && a3.state === "running" ? h2("button", { class: "iconbtn", title: "Open on a phone", "aria-label": "Open on a phone", onclick: () => showQR(a3) }, icon("phone")) : null;
    const signIn = entry?.login?.length && a3.state === "running" ? h2("button", { class: "iconbtn", title: "Sign-in details", "aria-label": "Sign-in details", onclick: () => showSignIn(a3, entry.login) }, icon("key")) : null;
    return a3.state === "running" ? [onPhone, signIn, btn("restart", "Restart"), btn("update", "Update: dump its database, pull the newest image, and recreate it"), back, btn("stop", "Stop (data is kept)", "danger"), logs] : [btn("start", "Start"), back, logs];
  }
  async function showQR(a3) {
    const panel = $2("cliPanel"), url = "https://" + a3.address;
    if (cliStop) cliStop();
    let img;
    try {
      img = await go().QR(url);
    } catch (e3) {
      return showError(e3);
    }
    panel.hidden = false;
    $2("cliTitle").textContent = `Open ${a3.name} on a phone`;
    $2("cliLog").hidden = true;
    const tailnet = /\.ts\.net(:|$)/.test(a3.address);
    const phoneApp = catalog?.apps.find((c3) => c3.id === a3.id)?.phone;
    $2("cliActions").replaceChildren(h2(
      "div",
      { class: "pairing" },
      h2("img", { src: img, alt: `QR code for ${url}`, width: 180, height: 180 }),
      h2(
        "div",
        {},
        h2("p", {}, "Point the phone’s camera at the code and tap the link. ", h2("code", {}, url)),
        h2("p", { class: "muted" }, tailnet ? "The phone needs the Tailscale app, signed in to the same tailnet; then it works at home and away." : "The phone needs to be on the home Wi-Fi (or on Tailscale away from home)."),
        phoneApp ? h2("p", { class: "muted" }, `Its phone app: ${phoneApp}.`) : "",
        h2("button", { class: "small", onclick: () => {
          panel.hidden = true;
          $2("cliLog").hidden = false;
        } }, "Close")
      )
    ));
    panel.scrollIntoView({ block: "nearest" });
  }
  async function showSignIn(a3, keys) {
    const panel = $2("cliPanel");
    if (cliStop) cliStop();
    let list2 = [];
    try {
      list2 = await go().Settings();
    } catch (e3) {
      return showError(e3);
    }
    const byKey = Object.fromEntries(list2.map((s3) => [s3.key, s3]));
    const label = (k3) => /PASSWORD$/.test(k3) ? "Password" : /EMAIL$/.test(k3) ? "Email" : /USER$/.test(k3) ? "User name" : settingLabel(k3);
    panel.hidden = false;
    $2("cliTitle").textContent = `Sign in to ${a3.name}`;
    $2("cliLog").textContent = "";
    $2("cliLog").hidden = true;
    const note = h2("span", { class: "muted" });
    const rows = keys.map((k3) => {
      const s3 = byKey[k3] || {};
      const copy = s3.secret ? () => go().CopySetting(k3).then(() => {
        note.textContent = "✓ Password copied; the clipboard clears in 90 seconds.";
      }, showError) : () => {
        window.runtime.ClipboardSetText?.(s3.value || "");
        note.textContent = `✓ ${label(k3)} copied.`;
      };
      return h2(
        "div",
        { class: "signin" },
        h2("span", { class: "muted" }, label(k3)),
        h2("strong", {}, s3.secret ? s3.set ? "••••••••" : "not set" : s3.value || "not set"),
        s3.set ? h2("button", { class: "small", onclick: copy }, "Copy") : null
      );
    });
    $2("cliActions").replaceChildren(
      h2("div", { class: "signins" }, rows),
      note,
      h2("button", { class: "small", onclick: () => {
        panel.hidden = true;
        $2("cliLog").hidden = false;
      } }, "Close")
    );
    panel.scrollIntoView({ block: "nearest" });
  }
  var actionTitle = { start: "Starting", stop: "Stopping", restart: "Restarting", update: "Updating", rollback: "Rolling back" };
  async function runAppAction(a3, action) {
    const panel = $2("cliPanel"), log = $2("cliLog"), actions = $2("cliActions");
    log.hidden = false;
    if (cliStop) cliStop();
    panel.hidden = false;
    $2("cliTitle").textContent = `${actionTitle[action]} ${a3.name}…`;
    log.textContent = "";
    progressBox = "cliProgress";
    cliProgress(null);
    actions.replaceChildren();
    $$(".rowActions button").forEach((b2) => b2.disabled = true);
    panel.scrollIntoView({ block: "nearest" });
    const off = window.runtime.EventsOn("cli:log", (line) => {
      log.textContent += line + "\n";
      log.scrollTop = log.scrollHeight;
    });
    let failed = false;
    try {
      await go().AppAction(a3.id, action);
    } catch (e3) {
      failed = true;
      showError(e3);
    }
    if (typeof off === "function") off();
    cliProgress(failed ? "failed" : "done");
    $2("cliTitle").textContent = failed ? `${actionTitle[action]} ${a3.name} failed` : `${a3.name}: ${action} done`;
    actions.replaceChildren(h2("button", { class: "small", onclick: () => panel.hidden = true }, "Close"));
    loadStatus();
  }
  var progressBox = "cliProgress";
  function cliProgress(s3) {
    const box = $2(progressBox);
    if (!s3) {
      box.hidden = true;
      return;
    }
    const fill = box.querySelector(".fill"), step = box.querySelector(".step");
    if (s3 === "done" || s3 === "failed") {
      if (box.hidden) return;
      fill.style.width = "100%";
      box.classList.toggle("failed", s3 === "failed");
      step.textContent = s3 === "done" ? "Done" : "Stopped with a problem; the log says which";
      return;
    }
    if (s3.total < 2) return;
    box.hidden = false;
    box.classList.remove("failed");
    fill.style.width = `${Math.round((s3.n - 0.5) / s3.total * 100)}%`;
    step.textContent = `${s3.text} · ${s3.n} of ${s3.total}`;
  }
  var logApp = null;
  async function showLogs(a3) {
    logApp = a3;
    const panel = $2("logPanel"), text = $2("logText");
    panel.hidden = false;
    $2("logTitle").textContent = `${a3.name}: last 200 lines`;
    text.textContent = "Loading…";
    const dozzle = statusById.dozzle;
    $2("logActions").replaceChildren(...[
      h2("button", { class: "small", onclick: () => showLogs(a3) }, "Refresh"),
      dozzle?.state === "running" && dozzle.url ? h2("button", { class: "small", title: "Follow every log live in Dozzle", onclick: () => go().Open(dozzle.url) }, "Open Dozzle") : null,
      h2("button", { class: "small", onclick: () => {
        panel.hidden = true;
        logApp = null;
      } }, "Close")
    ].filter(Boolean));
    try {
      const out = await go().Logs(a3.id, 200);
      if (logApp !== a3) return;
      text.textContent = out.trim() || "(the log is empty)";
      text.scrollTop = text.scrollHeight;
    } catch (e3) {
      if (logApp === a3) text.textContent = String(e3 && e3.message || e3);
    }
    panel.scrollIntoView({ block: "nearest" });
  }
  for (const panel of $$(".panel.sheet")) {
    let before = null;
    new MutationObserver(() => {
      document.documentElement.classList.toggle("sheet-open", !!document.querySelector(".panel.sheet:not([hidden])"));
      if (!panel.hidden) {
        if (!panel.contains(document.activeElement)) before = document.activeElement;
        requestAnimationFrame(() => ($1("button:not([disabled])", panel) || panel).focus());
      } else if (before && document.contains(before)) {
        before.focus();
        before = null;
      }
    }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  }
  document.addEventListener("keydown", (e3) => {
    if (e3.key !== "Escape") return;
    const open = $$(".panel.sheet:not([hidden])").pop();
    const close = open && $$("button:not([disabled])", open).find((b2) => /^(Close|Cancel)$/.test(b2.textContent.trim()));
    if (close) {
      e3.preventDefault();
      close.click();
    }
  });
  var cliStop = null;
  async function cliFlow(title, action, target, confirmLabel) {
    const panel = $2("cliPanel"), log = $2("cliLog"), actions = $2("cliActions");
    log.hidden = false;
    if (cliStop) cliStop();
    panel.hidden = false;
    $2("cliTitle").textContent = title;
    log.textContent = "";
    progressBox = "cliProgress";
    cliProgress(null);
    actions.replaceChildren();
    const off = window.runtime.EventsOn("cli:log", (line) => {
      if (/^Preview only: nothing was changed/.test(line.trim())) return;
      log.textContent += line + "\n";
      log.scrollTop = log.scrollHeight;
    });
    const stop = () => {
      if (typeof off === "function") off();
      if (cliStop === stop) cliStop = null;
    };
    cliStop = stop;
    try {
      await go().Homelab(action, target, false);
    } catch (e3) {
      showError(e3);
      stop();
      return;
    }
    actions.replaceChildren(
      h2("button", { class: "primary small", onclick: async (e3) => {
        e3.target.disabled = true;
        log.textContent += "\n";
        let failed = false;
        try {
          await go().Homelab(action, target, true);
        } catch (err) {
          failed = true;
          showError(err);
        }
        cliProgress(failed ? "failed" : "done");
        stop();
        actions.replaceChildren(h2("button", { class: "small", onclick: () => panel.hidden = true }, "Close"));
        loadStatus();
      } }, confirmLabel),
      h2("button", { class: "small", onclick: () => {
        stop();
        panel.hidden = true;
      } }, "Cancel")
    );
  }
  $2("cleanup").onclick = () => cliFlow("Remove old containers whose apps now run in the homelab", "cleanup", "", "Remove them");
  $2("fixIt").onclick = () => cliFlow("Fix it", "fix", "", "Fix these");
  $2("updateAll").onclick = () => cliFlow("Update all apps now", "update-all", "", "Update them");
  function closeMenu() {
    $2("statusMenu").hidden = true;
    $2("statusMore").setAttribute("aria-expanded", "false");
  }
  $2("statusMore").onclick = (e3) => {
    e3.stopPropagation();
    const open = $2("statusMenu").hidden;
    $2("statusMenu").hidden = !open;
    $2("statusMore").setAttribute("aria-expanded", String(open));
  };
  $2("statusMenu").addEventListener("click", closeMenu);
  document.addEventListener("click", (e3) => {
    if (!$2("statusMenu").hidden && !e3.target.closest(".menuwrap")) closeMenu();
  });
  document.addEventListener("keydown", (e3) => {
    if (e3.key === "Escape" && !$2("statusMenu").hidden) closeMenu();
  });
  var statusLoad = null;
  var statusAgain = false;
  function refreshStatus() {
    if (!$2("status").classList.contains("active")) return;
    if (statusLoad) {
      statusAgain = true;
      return;
    }
    statusLoad = loadStatus().finally(() => {
      statusLoad = null;
      if (statusAgain) {
        statusAgain = false;
        refreshStatus();
      }
    });
  }
  setInterval(refreshStatus, 6e4);
  var never = (t3) => !t3 || t3.startsWith("0001-");
  function untilText(t3) {
    const mins = Math.round((new Date(t3).getTime() - Date.now()) / 6e4);
    if (mins <= 1) return "now";
    if (mins < 60) return `in ${mins} minutes`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours === 1 ? "in an hour" : `in ${hours} hours`;
    const days = Math.round(hours / 24);
    return days === 1 ? "tomorrow" : `in ${days} days`;
  }
  var tookText = (s3) => s3 < 120 ? `${s3} seconds` : `${Math.round(s3 / 60)} minutes`;
  function restoreTile(t3, due) {
    const runs = t3.history || [];
    const newest = runs[runs.length - 1];
    const timed = runs.slice().reverse().find((r3) => r3.passed && r3.seconds > 0);
    let sub;
    if (newest && !newest.passed) sub = h2("span", { class: "bad" }, `Failed ${ago(newest.when)}: ${newest.summary}`);
    else if (due) sub = h2("span", { class: "warn" }, "Due: Test a restore");
    else sub = (t3.lastSummary || "Proven in the last 30 days") + (timed ? ` · in ${tookText(timed.seconds)}` : "");
    const record2 = runs.slice(-6).reverse().map((r3) => `${new Date(r3.when).toLocaleDateString(void 0, { day: "numeric", month: "short" })}: ${r3.passed ? "passed" : "failed"}${r3.seconds ? " in " + tookText(r3.seconds) : ""}`);
    const el = tile("Restore test", never(t3.lastTest) ? "Never" : ago(t3.lastTest), sub);
    el.id = "restoreTile";
    if (record2.length) el.title = `Restore drills on record (${runs.length}):
` + record2.join("\n");
    return el;
  }
  function ago(t3) {
    if (never(t3)) return "never";
    const mins = Math.max(0, Math.round((Date.now() - new Date(t3).getTime()) / 6e4));
    if (mins < 60) return mins <= 1 ? "just now" : `${mins} minutes ago`;
    const hours = Math.round(mins / 60);
    if (hours < 36) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? "yesterday" : `${days} days ago`;
  }
  function bytes(n2) {
    if (!n2) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let i3 = 0;
    while (n2 >= 1024 && i3 < units.length - 1) {
      n2 /= 1024;
      i3++;
    }
    return `${n2 < 10 && i3 ? n2.toFixed(1) : Math.round(n2)} ${units[i3]}`;
  }
  async function loadBackups() {
    let o3;
    try {
      o3 = await go().Backups();
    } catch (e3) {
      $2("backupRows").replaceChildren();
      showError(e3);
      return;
    }
    const order = { stale: 0, none: 1, fresh: 2 };
    const copies = (o3.copies || []).slice().sort((a3, b2) => order[a3.state] - order[b2.state]);
    const shortPath = (p3) => {
      const parts = p3.split("/").filter(Boolean);
      return parts.length > 2 ? "…/" + parts.slice(-2).join("/") : p3;
    };
    const fresh = copies.filter((c3) => c3.state === "fresh").length;
    const stale = copies.filter((c3) => c3.state === "stale");
    const t3 = o3.restoreTest || {};
    $2("backupTiles").replaceChildren(
      tile("Last backup", never(o3.lastRun) ? "Never" : ago(o3.lastRun), never(o3.envCopied) ? "Settings file not copied yet" : `Settings file copied ${ago(o3.envCopied)}`),
      tile("Fresh copies", [String(fresh), h2("small", {}, ` of ${copies.length}`)], stale.length ? h2("span", { class: "bad" }, "Stale: " + stale.map((c3) => c3.name).join(", ")) : `Each under ${o3.staleAfterHours} hours old`),
      tile("Destination", o3.destinationOK ? "Set" : h2("span", { class: "warn" }, "Not set"), o3.destinationOK ? h2("span", { title: o3.destination }, shortPath(o3.destination)) : osName === "linux" ? "Put a backup drive or a synced folder in Settings › BACKUP_DESTINATION" : "Put a Proton Drive folder in Settings › BACKUP_DESTINATION"),
      restoreTile(t3, o3.restoreDue)
    );
    const mark = { fresh: ["ok", "Fresh"], stale: ["bad", "Stale"], none: ["", "None yet"] };
    $2("backupRows").replaceChildren(...copies.map((c3) => {
      const [cls, word] = mark[c3.state] || ["", c3.state];
      return h2(
        "tr",
        {},
        h2("td", {}, h2("strong", {}, c3.name), h2("span", { class: "local" }, c3.volume ? "volume archive" : "database")),
        h2("td", { class: "state" }, h2("span", { class: "dot " + cls }), c3.state === "none" ? word : `${word} · ${ago(c3.newest)}`),
        h2("td", {}, bytes(c3.size)),
        h2("td", {}, c3.count ? String(c3.count) : "—")
      );
    }));
    if (!copies.length) $2("backupRows").append(h2("tr", {}, h2("td", { colspan: 4, class: "muted" }, "No installed app has a database to dump yet.")));
    const plain = o3.plainExports || [];
    $2("vaultCard").replaceChildren(
      h2(
        "div",
        { class: "row" },
        h2("h2", {}, "Password vault export"),
        plain.length ? h2("span", { class: "bad" }, "✗ Delete the plain export") : never(o3.vaultExport) ? h2("span", { class: "warn" }, "Never exported") : o3.vaultDue ? h2("span", { class: "warn" }, `Due: last ${ago(o3.vaultExport)}`) : h2("span", { class: "ok" }, `✓ Exported ${ago(o3.vaultExport)}`)
      ),
      plain.length ? h2("p", { class: "bad" }, `${plain.join(", ")} in recovery-staging/secrets holds every password readable. Delete it, then export again encrypted.`) : "",
      h2("p", {}, "The database backup needs the server to open. Once a month, also keep an export you can open anywhere: in the Bitwarden web vault, Tools › Export vault › .json (Encrypted) › Password protected, with that password kept outside the vault. Save it in ", h2("code", {}, "recovery-staging/secrets"), " and the nightly Secrets job takes it off-site. The backup reminds you when one is due.")
    );
    $2("backupsCount").textContent = stale.length + plain.length ? String(stale.length + plain.length) : "";
    loadDuplicatiJobs();
    const dup = statusById.duplicati;
    $2("openDuplicati").hidden = !(dup?.state === "running" && dup.url);
    $2("openDuplicati").onclick = () => go().Open(dup.url);
  }
  async function loadDuplicatiJobs() {
    const card = $2("dupCard");
    let jobs;
    $2("restoreTest").hidden = true;
    try {
      jobs = await go().DuplicatiJobs();
    } catch (e3) {
      const msg = String(e3 && e3.message || e3);
      card.replaceChildren(h2(
        "div",
        { class: "row" },
        h2("h2", {}, "Off-site jobs (Duplicati)"),
        h2("span", { class: "muted" }, /DUPLICATI_PASSWORD is empty/.test(msg) ? "Shown here once DUPLICATI_PASSWORD is in Settings." : msg)
      ));
      return;
    }
    if (!jobs?.length) {
      card.replaceChildren(
        h2(
          "div",
          { class: "row" },
          h2("h2", {}, "Off-site jobs (Duplicati)"),
          h2("button", { class: "small", onclick: () => backupTask("duplicati-setup", "Creating the backup jobs…", "Backup jobs created", "Creating the jobs stopped: the log says why") }, "Create the backup jobs")
        ),
        h2("p", { class: "muted" }, "No jobs yet. This makes the jobs in docs/Automation.md, encrypted with passphrases kept in .env, and runs the small ones once. Then copy DUPLICATI_SECRETS_PASSPHRASE from Settings into Vaultwarden.")
      );
      return;
    }
    $2("restoreTest").hidden = !jobs.some((j3) => j3.name.toLowerCase() === "homelab appdata" && j3.state !== "never");
    const mark = { ok: ["ok", "Ran"], failed: ["bad", "Failed"], stale: ["warn", "Not run for over a week"], never: ["warn", "Never run"] };
    const bad = jobs.filter((j3) => j3.state !== "ok").length;
    card.replaceChildren(
      h2("div", { class: "row" }, h2("h2", {}, "Off-site jobs (Duplicati)"), bad ? h2("span", { class: "warn" }, `${bad} need a look`) : h2("span", { class: "ok" }, `✓ All ${jobs.length} ran`)),
      h2("ul", { class: "alertlist" }, jobs.map((j3) => {
        const [cls, word] = mark[j3.state] || ["", j3.state];
        return h2(
          "li",
          {},
          h2("span", { class: "dot " + cls }),
          h2("div", { class: "grow" }, h2("strong", {}, j3.name), j3.errorMessage ? h2("div", { class: "bad" }, j3.errorMessage) : j3.state !== "ok" ? h2("div", { class: "muted" }, word) : null),
          j3.size ? h2("span", { class: "size muted" }, j3.size) : "",
          h2(
            "span",
            { class: "when muted", title: never(j3.nextRun) ? "" : "Next run " + new Date(j3.nextRun).toLocaleString() },
            never(j3.lastFinished) ? "never" : ago(j3.lastFinished),
            never(j3.nextRun) ? "" : h2("span", { class: "next" }, " · next " + untilText(j3.nextRun))
          )
        );
      }))
    );
  }
  async function backupTask(action, busy, done, failed) {
    const panel = $2("backupPanel"), log = $2("backupLog"), btns = [$2("backupNow"), $2("restoreTest")];
    panel.hidden = false;
    $2("backupTitle").textContent = busy;
    log.textContent = "";
    progressBox = "backupProgress";
    cliProgress(null);
    btns.forEach((b2) => {
      b2.disabled = true;
    });
    const off = window.runtime.EventsOn("cli:log", (line) => {
      log.textContent += line + "\n";
      log.scrollTop = log.scrollHeight;
    });
    let ok = true;
    try {
      await go().Homelab(action, "", action === "backup");
    } catch (e3) {
      ok = false;
      showError(e3);
    }
    cliProgress(ok ? "done" : "failed");
    progressBox = "cliProgress";
    if (typeof off === "function") off();
    $2("backupTitle").textContent = ok ? done : failed;
    btns.forEach((b2) => {
      b2.disabled = false;
    });
    loadBackups();
  }
  async function moveTask(direction, button) {
    if (direction === "out" && button.dataset.sure !== "1") {
      button.dataset.sure = "1";
      button.textContent = "Click again: back up, stop every app, and pack";
      return;
    }
    const panel = $2("backupPanel"), log = $2("backupLog");
    button.disabled = true;
    panel.hidden = false;
    $2("backupTitle").textContent = direction === "out" ? "Moving out (a backup first, then packing)…" : "Moving in…";
    log.textContent = "";
    const off = window.runtime.EventsOn("cli:log", (line) => {
      log.textContent += line + "\n";
      log.scrollTop = log.scrollHeight;
    });
    let file = "", ok = true;
    try {
      file = await go().Move(direction);
    } catch (e3) {
      ok = false;
      showError(e3);
    }
    if (typeof off === "function") off();
    button.disabled = false;
    delete button.dataset.sure;
    button.textContent = direction === "out" ? "Move out…" : "Move in…";
    if (ok && !file) {
      panel.hidden = true;
      return;
    }
    $2("backupTitle").textContent = !ok ? "The move stopped: the log says why" : direction === "out" ? "Packed. This machine is stopped: take the file and the media drive to the new one" : "Moved in: the apps that ran before are starting";
  }
  $2("moveOut").onclick = (e3) => moveTask("out", e3.target);
  $2("moveIn").onclick = (e3) => moveTask("in", e3.target);
  $2("backupNow").onclick = () => backupTask("backup", "Backing up…", "Backup done", "The backup failed: the log says which step");
  $2("recoveryKit").onclick = async () => {
    const btn = $2("recoveryKit");
    btn.disabled = true;
    try {
      await go().RecoveryKit();
    } catch (e3) {
      showError(e3);
    }
    btn.disabled = false;
  };
  $2("restoreTest").onclick = () => backupTask("restore-test", "Testing a restore (a few minutes)…", "Restore test passed", "The restore test failed: the log says why");
  var hostOS = "";
  function newestBuildSteps() {
    if (hostOS.startsWith("Windows")) return "download Homelab-Wizard-Windows-Setup.exe and run it";
    if (hostOS.startsWith("Linux")) return "download the package for this system (.deb, .rpm, or the Arch package), or the AppImage";
    return "open the latest build, download Homelab-Wizard-macOS.dmg, quit this app, and drag the new one to Applications";
  }
  function whereBackgroundIs() {
    if (hostOS.startsWith("Windows")) return "Windows starts them when you sign in: Task Manager › Startup apps lists them as homelab-run.";
    if (hostOS.startsWith("macOS") || !hostOS) return "macOS lists these in System Settings › General › Login Items & Extensions, under Homelab Wizard.";
    return "systemd runs them for you as the homelab-agent service: systemctl --user status homelab-agent shows it.";
  }
  function backgroundRow() {
    const box = h2("div", { id: "bgList", class: "bglist", hidden: true });
    const summary = h2("span", {}, "the scheduled jobs ");
    const toggle = h2("a", { id: "bgToggle", class: "small", onclick: async () => {
      if (!box.hidden) {
        box.hidden = true;
        toggle.textContent = "What are these?";
        return;
      }
      let jobs = [];
      try {
        jobs = await go().Background();
      } catch (e3) {
        return showError(e3);
      }
      box.replaceChildren(
        h2("ul", { class: "alertlist" }, jobs.map((j3) => h2(
          "li",
          {},
          h2("span", { class: "dot " + (j3.installed ? "ok" : "") }),
          h2("div", { class: "grow" }, h2("strong", {}, j3.name), h2("div", { class: "muted" }, j3.what)),
          h2("span", { class: "when muted", title: j3.label }, j3.installed ? j3.when : "not installed")
        ))),
        h2("p", { class: "muted small" }, `${whereBackgroundIs()} They only work on the homelab, and only use power while they run. Uninstalling (homelab uninstall) removes every one.`),
        ...jobs.some((j3) => j3.installed && j3.label !== "tray") ? [h2("button", { id: "bgOff", class: "small", title: "The apps keep running, but nothing starts them after a restart, backs them up at night, or watches them. Setup offers to put the jobs back.", onclick: () => {
          show("status");
          cliFlow("Turn off the scheduled jobs", "jobs-remove", "", "Turn them off");
        } }, "Turn the scheduled jobs off")] : []
      );
      box.hidden = false;
      toggle.textContent = "Hide";
    } }, "What are these?");
    return [summary, toggle, box];
  }
  async function loadHost() {
    const i3 = await go().Host();
    hostOS = i3.os || "";
    document.documentElement.classList.toggle("backdrop", !!i3.backdrop);
    const atLogin = await go().TrayAtLogin().catch(() => null);
    const menu = await go().MenuEntry().catch(() => null);
    const row = (k3, v3) => h2("div", {}, h2("dt", {}, k3), h2("dd", {}, v3));
    $2("hostInfo").replaceChildren(
      row("Machine", [i3.supported ? i3.osVersion || i3.os : `${i3.osVersion || i3.os} (not supported)`, i3.model || i3.machine ? h2("span", { class: "muted" }, " · " + (i3.model || i3.machine)) : null]),
      row("Container runtime", i3.runtimeOK ? [h2("span", { class: "dot ok" }), i3.runtimeFound] : h2("span", { class: "bad" }, `${i3.runtime} is not ready: ${i3.runtimeHint}`)),
      row("Runs in the background", backgroundRow()),
      atLogin === null ? "" : row(i3.os.startsWith("macOS") ? "Menu bar item" : "Tray icon", trayAtLoginRow(atLogin)),
      menu && menu.available ? row("App menu", menuEntryRow(menu.added)) : "",
      row("Homelab folder", [
        i3.rootOK ? i3.root : h2("span", { class: "bad" }, i3.kit ? "not set up yet" : "not found"),
        " ",
        h2("a", { class: "small", title: "Choose the folder with compose.yaml", onclick: chooseRoot }, i3.rootOK ? "Change…" : "Choose…")
      ]),
      (i3.disks || []).length ? h2("div", { class: "diskrow" }, h2("dt", {}, "Storage"), h2("dd", {}, h2("div", { id: "diskSpace", class: "disks" }, i3.disks.map(diskBar)))) : "",
      h2("div", {}, h2("dt", {}, "Version"), h2("dd", { id: "versionInfo" }, i3.version, h2("span", { id: "upgradeState" })))
    );
    $2("foot").replaceChildren(h2("span", { class: "part" }, i3.osVersion || i3.os), " · ", h2("span", { class: "part" }, i3.version));
    if (i3.rootOK) loadUpgrade(false);
    renderNewHomelab(i3);
    renderRuntime(i3);
    return i3;
  }
  function diskBar(d3) {
    const used = d3.total ? Math.min(100, Math.max(1, Math.round(100 * (1 - d3.free / d3.total)))) : 0;
    return h2(
      "div",
      { class: "disk" + (d3.low ? " low" : ""), title: d3.hint || "" },
      h2("div", { class: "dhead" }, h2("strong", {}, d3.name || "Internal disk"), h2("span", { class: d3.low ? "bad" : "muted" }, d3.space.replace(/\s*\(\d+%\)$/, ""))),
      d3.total ? h2("div", { class: "storagebar", role: "meter", "aria-valuenow": used, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": `${used}% used` }, h2("span", { style: `width:${used}%` })) : null,
      h2("div", { class: "muted small" }, d3.label),
      d3.low ? h2("div", { class: "muted small" }, d3.hint) : null
    );
  }
  var runtimeWatch = null;
  function renderRuntime(i3) {
    const card = $2("runtimeCard");
    card.hidden = !!i3.runtimeOK;
    clearInterval(runtimeWatch);
    if (card.hidden) return;
    runtimeWatch = setInterval(async () => {
      const now = await go().Host().catch(() => null);
      if (now && now.runtimeOK) {
        clearInterval(runtimeWatch);
        await loadHost();
        loadSetup();
      }
    }, 5e3);
    const service = (i3.os || "").startsWith("Linux");
    const steps = i3.runtimeInstalled ? [
      h2("p", {}, service ? `${i3.runtime} is installed but not running. Start it now and at every boot; your password is asked for once.` : `${i3.runtime} is installed but not running. Open it, accept what it asks the first time, and turn on starting at login in its settings.`),
      h2(
        "div",
        { class: "actions" },
        h2("button", { id: "startRuntime", class: "primary", onclick: () => go().StartRuntime().catch(showError) }, `${service ? "Start" : "Open"} ${i3.runtime}`),
        h2("span", { class: "muted" }, "This screen moves on by itself once it is running.")
      )
    ] : service ? [
      h2("ol", {}, h2("li", {}, `Install ${i3.runtime} and its compose plugin from your system's packages (the guide has the commands).`), h2("li", {}, "Add yourself to the docker group, then log out and back in.")),
      h2(
        "div",
        { class: "actions" },
        i3.runtimeDownload ? h2("button", { id: "getRuntime", class: "primary", onclick: () => go().Open(i3.runtimeDownload) }, "Open the install guide") : null,
        h2("span", { class: "muted" }, "This screen moves on by itself once it is running.")
      )
    ] : [
      h2("ol", {}, h2("li", {}, `Download ${i3.runtime}, the engine every app runs in.`), h2("li", {}, "Open the downloaded file and drag it to Applications (or run the installer)."), h2("li", {}, "Open it once and accept what it asks.")),
      h2(
        "div",
        { class: "actions" },
        i3.runtimeDownload ? h2("button", { id: "getRuntime", class: "primary", onclick: () => go().Open(i3.runtimeDownload) }, `Download ${i3.runtime}`) : null,
        h2("span", { class: "muted" }, `Or in Terminal: ${i3.runtimeHint}. This screen moves on by itself once it is running.`)
      )
    ];
    card.replaceChildren(h2("h2", {}, i3.runtimeInstalled ? `Start ${i3.runtime}` : `Install ${i3.runtime}`), ...steps);
  }
  function renderNewHomelab(i3) {
    const card = $2("newHomelab");
    card.hidden = i3.rootOK || !i3.kit;
    if (card.hidden) return;
    const btn = h2("button", { id: "createHomelab", class: "primary", onclick: async () => {
      btn.disabled = true;
      btn.textContent = "Setting it up…";
      try {
        await go().CreateHomelab();
        await loadHost();
        await loadCatalog();
        await loadSetup();
      } catch (e3) {
        showError(e3);
        btn.disabled = false;
        btn.textContent = "Set it up for me";
      }
    } }, "Set it up for me");
    card.replaceChildren(
      h2("h2", {}, "Start your homelab"),
      h2("p", {}, `Homelab Wizard makes the folder everything lives in, at ${i3.newRoot}, with the apps' settings and guides. Your photos, media, and backups can live elsewhere; Settings says where.`),
      h2("div", { class: "actions" }, btn, h2("span", { class: "muted" }, "Already have one? ", h2("a", { onclick: chooseRoot }, "Choose it")))
    );
  }
  function trayAtLoginRow(on) {
    return [
      on ? h2("span", { class: "ok" }, "✓ starts at login") : h2("span", { class: "muted" }, "only while the app is open"),
      " ",
      h2("button", { class: "small", id: "trayAtLogin", onclick: async (e3) => {
        e3.target.disabled = true;
        try {
          await go().SetTrayAtLogin(!on);
        } catch (err) {
          showError(err);
        }
        loadHost();
      } }, on ? "Turn off" : "Start at login")
    ];
  }
  function menuEntryRow(added) {
    return [
      added ? h2("span", { class: "ok" }, "✓ in the app menu") : h2("span", { class: "muted" }, "opened from its file"),
      " ",
      h2("button", { class: "small", id: "menuEntry", onclick: async (e3) => {
        e3.target.disabled = true;
        try {
          await go().SetMenuEntry(!added);
        } catch (err) {
          showError(err);
        }
        loadHost();
      } }, added ? "Remove" : "Add to the app menu")
    ];
  }
  async function loadUpgrade(force) {
    const card = $2("upgradeCard");
    let c3;
    try {
      c3 = await go().UpgradeCheck(force);
    } catch (e3) {
      card.hidden = true;
      document.getElementById("upgradeState")?.replaceChildren(h2("span", { class: "muted", title: String(e3 && e3.message || e3) }, " · no update check"));
      return;
    }
    const n2 = c3.behind, s3 = n2 === 1 ? "" : "s";
    footUpdate(n2 > 0 || !!c3.appUpdate || c3.appBehind > 0);
    document.getElementById("upgradeState")?.replaceChildren(
      n2 ? h2("span", { class: "warn" }, ` · ${n2} new change${s3}`) : h2("span", { class: "ok" }, " · ✓ up to date"),
      c3.appCommit ? h2("span", { class: "muted", title: "The commit this app was built from" }, ` · build ${c3.appCommit.slice(0, 7)}`) : "",
      ...c3.previous ? [" · ", goBackLink(c3.previous)] : []
    );
    const releases = c3.web ? c3.web + (c3.channel === "stable" ? "/releases" : "/actions/workflows/release.yml") : "";
    const app = c3.appUpdate;
    if (!n2 && app) {
      card.hidden = false;
      card.replaceChildren(
        h2(
          "div",
          { class: "row" },
          h2("h2", {}, app.version ? `Homelab Wizard ${app.version} is ready` : "A newer Homelab Wizard is ready"),
          app.canInstall ? h2("button", { id: "appUpdateBtn", class: "primary small", onclick: installApp }, "Update now") : h2("button", { class: "primary small", onclick: () => go().Open(app.page) }, "Download it")
        ),
        h2("p", { class: "muted" }, app.canInstall ? "Update now downloads it, puts it in place of this one, and opens it again. Your homelab keeps running." : `Download it from the release page: ${newestBuildSteps()}.`)
      );
      return;
    }
    if (!n2 && c3.appBehind > 0) {
      card.hidden = false;
      card.replaceChildren(
        h2(
          "div",
          { class: "row" },
          h2("h2", {}, "A newer Homelab Wizard is ready"),
          releases ? h2("button", { class: "primary small", onclick: () => go().Open(releases) }, "Open the release builds") : ""
        ),
        h2("p", {}, `The homelab folder has ${c3.appBehind} change${c3.appBehind === 1 ? "" : "s"} to the app since this build. Download the newest: ${newestBuildSteps()} (Upgrading.md).`)
      );
      return;
    }
    card.hidden = !n2;
    if (!n2) return;
    const notes = [];
    if (c3.newVersion && c3.newVersion !== c3.version) notes.push(`Version ${c3.version} → ${c3.newVersion}.`);
    if (c3.settingsChanged) notes.push("New settings are added to .env on the way.");
    if (app?.canInstall) notes.push("The app updates too, and opens again.");
    else if (c3.selfUpdates && (c3.appChanged || app)) notes.push("The app updates too, once its new build is out: the banner offers it.");
    else if (c3.appChanged || app) notes.push(`The desktop app changed too: afterwards, ${newestBuildSteps()}.`);
    if (c3.dirty?.length) notes.push(`Edited here, and kept: ${c3.dirty.join(", ")}.`);
    if (c3.ahead) notes.push(`This folder has ${c3.ahead} commit(s) of its own, so it cannot simply move forward.`);
    if (c3.fetchError) notes.push("GitHub could not be reached just now; this is from the last check.");
    const shown = (c3.changes || []).slice(0, 6);
    card.replaceChildren(
      h2(
        "div",
        { class: "row" },
        h2("h2", {}, `Update the homelab: ${n2} new change${s3}`),
        h2("button", { id: "upgradeBtn", class: "primary small", onclick: () => runUpgrade(app), disabled: c3.ahead > 0 }, "Update")
      ),
      h2("ul", { class: "alertlist" }, shown.map((ch) => h2(
        "li",
        {},
        h2("span", { class: "dot" }),
        h2("div", { class: "grow" }, ch.subject),
        h2("span", { class: "when muted" }, ago(ch.when))
      ))),
      n2 > shown.length ? h2("p", { class: "muted" }, `and ${n2 - shown.length} more`) : "",
      notes.length ? h2("p", {}, notes.join(" ")) : "",
      c3.notes?.length ? h2("details", { class: "whatsnew" }, h2("summary", {}, `What is new (${c3.notes.length})`), h2("ul", {}, c3.notes.map((t3) => h2("li", {}, t3)))) : "",
      h2("p", { class: "muted" }, `Update moves the homelab folder forward to ${c3.channel === "stable" && c3.target ? c3.target + " (the stable channel)" : c3.upstream}, never merging or overwriting your own edits, then starts the homelab again so changed apps are recreated. Upgrading.md says what each batch of changes asks of you.`)
    );
  }
  function footUpdate(on) {
    document.getElementById("footUpdate")?.remove();
    if (on) $2("foot").append(h2("a", { id: "footUpdate", class: "update", title: "Open Setup to update", onclick: () => {
      navigated = true;
      show("setup");
    } }, "● Update ready"));
  }
  setInterval(() => {
    if (document.getElementById("versionInfo")) loadUpgrade(false);
  }, 36e5);
  var updateLater = "";
  function updateBanner(u4) {
    const box = $2("updateBanner");
    if (!u4 || u4.commit === updateLater || document.documentElement.classList.contains("companion")) {
      box.hidden = true;
      return;
    }
    const notes = u4.notes || [];
    const list2 = h2("ul", { id: "updateNotes", hidden: true }, [
      ...notes.slice(0, 12).map((n2) => h2("li", {}, n2)),
      ...notes.length > 12 ? [h2("li", { class: "muted" }, `and ${notes.length - 12} more`)] : []
    ]);
    const toggle = notes.length ? h2("a", { id: "updateWhatsNew", class: "small", onclick: () => {
      list2.hidden = !list2.hidden;
      toggle.textContent = list2.hidden ? "What’s new" : "Hide";
    } }, "What’s new") : null;
    const quit = h2("input", { type: "checkbox", id: "installOnQuit", onchange: async (e3) => {
      try {
        await go().SetInstallOnQuit(e3.target.checked);
      } catch (err) {
        e3.target.checked = !e3.target.checked;
        showError(err);
      }
    } });
    quit.checked = !!u4.installOnQuit;
    box.replaceChildren(
      h2(
        "div",
        { class: "row" },
        h2("strong", { class: "grow" }, u4.version ? `Homelab Wizard ${u4.version} is ready` : "A Homelab Wizard update is ready"),
        toggle,
        h2("button", { id: "updateLater", class: "small", onclick: () => {
          updateLater = u4.commit;
          box.hidden = true;
        } }, "Later"),
        h2("button", { id: "updateRestart", class: "primary small", title: u4.ready ? "Already downloaded: the app closes and opens again in a few seconds" : "Downloads it (a minute or two), then the app closes and opens again", onclick: async (e3) => {
          e3.target.disabled = true;
          e3.target.textContent = u4.ready ? "Restarting…" : "Downloading…";
          try {
            await go().InstallAppUpdate();
          } catch (err) {
            e3.target.disabled = false;
            e3.target.textContent = "Restart to update";
            showError(err);
          }
        } }, "Restart to update")
      ),
      list2,
      u4.canInstallOnQuit === false ? "" : h2("label", {}, quit, "Install updates when I quit the app, without asking"),
      h2("span", { class: "muted small" }, "Your homelab keeps running while the app updates." + (u4.canInstallOnQuit === false ? isMac ? "" : " Installing asks for an administrator’s password." : "") + (isMac ? " Afterwards macOS may say Homelab Wizard added items that can run in the background: that is this update, not something new. The app is not signed with a Developer ID, so macOS sees each build as new." : ""))
    );
    box.hidden = false;
  }
  window.runtime?.EventsOn?.("app:update", updateBanner);
  try {
    go().PendingAppUpdate().then(updateBanner).catch(() => {
    });
  } catch {
  }
  function goBackLink(p3) {
    const a3 = h2("a", { id: "upgradeBack", title: `The homelab files as they were before the update of ${new Date(p3.when).toLocaleString()}; settings and data stay` }, `go back to ${p3.version} (${p3.commit.slice(0, 7)})`);
    keyable(a3);
    a3.onclick = async () => {
      if (!a3.dataset.sure) {
        a3.dataset.sure = "1";
        a3.textContent = `click again to go back to ${p3.version}`;
        return;
      }
      const log = $2("setupLog");
      log.hidden = false;
      log.textContent = "Going back…\n";
      const off = window.runtime.EventsOn("cli:log", (line) => {
        log.textContent += line + "\n";
        log.scrollTop = log.scrollHeight;
      });
      try {
        await go().Homelab("upgrade-back", "", true);
      } catch (e3) {
        showError(e3);
      }
      if (typeof off === "function") off();
      loadUpgrade(true);
    };
    return a3;
  }
  async function installApp() {
    const log = $2("setupLog"), btn = $2("appUpdateBtn");
    if (btn) btn.disabled = true;
    log.hidden = false;
    log.textContent += "Downloading the newest Homelab Wizard (a minute or two)…\n";
    try {
      await go().InstallAppUpdate();
      log.textContent += "Opening the new version…\n";
    } catch (e3) {
      if (btn) btn.disabled = false;
      log.textContent += "The app update stopped; the homelab is fine. Try again, or download it from the release page.\n";
      showError(e3);
    }
  }
  async function runUpgrade(app) {
    const log = $2("setupLog"), btn = $2("upgradeBtn");
    btn.disabled = true;
    log.hidden = false;
    log.textContent = "Getting the update…\n";
    const off = window.runtime.EventsOn("cli:log", (line) => {
      log.textContent += line + "\n";
      log.scrollTop = log.scrollHeight;
    });
    let ok = true;
    try {
      await go().Homelab("upgrade", "", true);
    } catch (e3) {
      ok = false;
      showError(e3);
    }
    if (typeof off === "function") off();
    log.textContent += ok ? "\nThe homelab is up to date.\n" : "\nThe update stopped: the log says why. Nothing was merged or overwritten.\n";
    if (ok && app?.canInstall) return installApp();
    await loadHost();
    loadCatalog();
    loadSetup();
  }
  $2("report").onclick = async () => {
    const log = $2("setupLog"), btn = $2("report");
    btn.disabled = true;
    log.hidden = false;
    log.textContent = "Making the report (about a minute)…\n";
    const off = window.runtime.EventsOn("cli:log", (line) => {
      log.textContent += line + "\n";
      log.scrollTop = log.scrollHeight;
    });
    let ok = true;
    try {
      await go().Homelab("report", "", false);
    } catch (e3) {
      ok = false;
      showError(e3);
    }
    if (typeof off === "function") off();
    btn.disabled = false;
    if (ok) {
      const reveal = hostOS.startsWith("macOS") ? "Show in Finder" : hostOS.startsWith("Windows") ? "Show in Explorer" : "Show the file";
      log.append(h2(
        "div",
        { class: "actions reveal" },
        h2("button", { class: "small", onclick: () => go().RevealReport().catch(showError) }, reveal),
        h2("button", { id: "emailReport", class: "small", onclick: () => go().EmailReport().catch(showError) }, "Email it to my helper"),
        h2("span", { class: "muted" }, "Read it through, then share the file when asking for help. Email starts a message to HELPER_EMAIL and shows the file to attach.")
      ));
    }
  };
  async function chooseRoot() {
    try {
      await go().ChooseRoot();
      await loadHost();
      await loadCatalog();
      await loadSetup();
    } catch (e3) {
      showError(e3);
    }
  }
  var lastSteps = [];
  var showDoneSteps = false;
  function renderSetup(steps) {
    lastSteps = steps;
    const done = steps.filter((s3) => s3.state === "done").length;
    $2("checkTitle").textContent = done === steps.length ? `First-time setup · all ${steps.length} done` : `First-time setup · ${done} of ${steps.length} done`;
    $2("setupMeter").style.width = steps.length ? `${Math.round(100 * done / steps.length)}%` : "0";
    setupBadge(steps.length - done);
    const ready = runnable(steps);
    $2("runAll").hidden = runningAll || ready.length < 2;
    if (!runningAll) $2("runAll").textContent = `Do the ${ready.length} steps I can`;
    const fold = done > 0 && done < steps.length && !showDoneSteps;
    const summary = done > 0 && done < steps.length ? h2(
      "li",
      { class: "done folded" },
      h2("span", { class: "mark" }, icon("check")),
      h2("div", { class: "body" }, h2("strong", { class: "title" }, `${done} done`)),
      h2("div", { class: "actions" }, h2("a", { id: "toggleDone", class: "small", onclick: () => {
        showDoneSteps = !showDoneSteps;
        renderSetup(lastSteps);
      } }, showDoneSteps ? "Hide" : "Show"))
    ) : null;
    $2("checklist").replaceChildren(...summary ? [summary] : [], ...steps.map((s3, i3) => {
      if (fold && s3.state === "done") return null;
      const actions = [];
      if (s3.state !== "waiting" && s3.state !== "done") {
        if (s3.settings?.length) actions.push(h2("button", { class: "small", onclick: () => showSettings(s3.settings) }, "Fill in settings"));
        if (s3.run?.length) actions.push(h2("button", { class: "small", onclick: (e3) => runStep(s3, e3.target) }, s3.runLabel || "Run"));
        (s3.choices || []).forEach((c3, ci) => actions.push(h2("button", { class: "small choice", onclick: (e3) => runStep(s3, e3.target, ci) }, c3.label)));
        if (s3.open) actions.push(link(s3.open, "Open " + s3.open.replace(/^https?:\/\//, "").replace(/\/$/, "")));
      }
      if (s3.id === "vaultwarden" && s3.state !== "waiting" && s3.state !== "done") {
        actions.push(h2("button", { class: "small", onclick: async () => {
          const log = $2("setupLog");
          log.hidden = false;
          const off = window.runtime.EventsOn("cli:log", (line) => {
            log.textContent += line + "\n";
          });
          try {
            await go().Homelab("signups-close", "", true);
          } catch (e3) {
            showError(e3);
          }
          if (typeof off === "function") off();
        } }, "Close sign-ups now"));
      }
      if (s3.manual && s3.state !== "waiting") {
        actions.push(h2("label", { class: "small" }, h2("input", {
          type: "checkbox",
          checked: s3.state === "done",
          onchange: async (e3) => {
            try {
              renderSetup(await go().MarkSetupDone(s3.id, e3.target.checked));
            } catch (err) {
              showError(err);
            }
          }
        }), " Done"));
      }
      return h2(
        "li",
        { class: s3.state },
        h2("span", { class: "mark" }, s3.state === "done" ? icon("check") : String(i3 + 1)),
        h2(
          "div",
          { class: "body" },
          h2("strong", { class: "title" }, s3.title),
          h2("div", { class: "sub muted" }, s3.why),
          s3.state !== "done" && s3.detail ? h2("div", { class: "sub" }, s3.detail) : null
        ),
        actions.length ? h2("div", { class: "actions" }, actions) : null
      );
    }).filter(Boolean));
  }
  function setupBadge(left) {
    $2("setupCount").textContent = left ? String(left) : "";
  }
  async function loadSetup() {
    $2("checkTitle").textContent = "First-time setup · checking…";
    try {
      renderSetup(await go().Setup());
    } catch (e3) {
      showError(e3);
    }
  }
  $2("recheck").onclick = () => {
    loadSetup();
    loadHost().then(() => loadUpgrade(true));
  };
  function runnable(steps) {
    return steps.filter((s3) => s3.state === "todo" && s3.run?.length);
  }
  var runningAll = false;
  $2("runAll").onclick = async () => {
    const log = $2("setupLog"), btn = $2("runAll");
    runningAll = true;
    btn.disabled = true;
    log.hidden = false;
    log.textContent = "";
    const off = window.runtime.EventsOn("setup:log", (line) => {
      log.textContent += line + "\n";
      log.scrollTop = log.scrollHeight;
    });
    const tried = /* @__PURE__ */ new Set();
    try {
      for (; ; ) {
        const next = runnable(lastSteps || []).find((s3) => !tried.has(s3.id));
        if (!next) break;
        tried.add(next.id);
        btn.textContent = `Doing: ${next.title}…`;
        log.textContent += `
— ${next.title}
`;
        renderSetup(await go().RunSetup(next.id));
      }
      log.textContent += "\nDone. What is left needs you: a setting to fill in, a choice, or a step only a person can do.\n";
    } catch (e3) {
      showError(e3);
      log.textContent += "\nStopped at a step that failed: the log above says why.\n";
    } finally {
      if (typeof off === "function") off();
      runningAll = false;
      btn.disabled = false;
      loadSetup();
    }
  };
  async function runStep(step, button, choice) {
    const log = $2("setupLog");
    log.hidden = false;
    log.textContent = "";
    button.disabled = true;
    const off = window.runtime.EventsOn("setup:log", (line) => {
      log.textContent += line + "\n";
      log.scrollTop = log.scrollHeight;
    });
    try {
      renderSetup(await (choice === void 0 ? go().RunSetup(step.id) : go().RunSetupChoice(step.id, choice)));
    } catch (e3) {
      showError(e3);
      loadSetup();
    } finally {
      if (typeof off === "function") off();
    }
  }
  var changed = {};
  var testable = null;
  async function loadPhones() {
    const card = $2("phonesCard");
    let phones;
    try {
      phones = await go().Phones();
    } catch (e3) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    const name = h2("input", { id: "phoneName", placeholder: "Name, e.g. Anna’s iPhone", autocomplete: "off", spellcheck: "false" });
    const canChange = h2("input", { type: "checkbox", id: "phoneCanChange" });
    card.replaceChildren(
      h2("div", { class: "row" }, h2("h2", {}, "Phones"), h2("span", { class: "muted" }, phones.length ? `${phones.length} paired` : "none paired yet")),
      h2("p", { class: "muted" }, "Status and Backups on your phones, at home and on the tailnet (never on the internet). Each phone pairs once with a code; it can only look unless you let it make changes."),
      phones.length ? h2("ul", { class: "alertlist" }, phones.map((p3) => h2(
        "li",
        {},
        h2("span", { class: "dot " + (p3.canChange ? "warn" : "ok") }),
        h2("div", { class: "grow" }, h2("strong", {}, p3.name), h2("div", { class: "muted" }, `${p3.canChange ? "Can make changes" : "Looks only"} · last seen ${ago(p3.lastSeen)}`)),
        h2("button", { class: "small", title: p3.canChange ? "Only look from now on" : "Let it start, stop, restart, update, and back up", onclick: async () => {
          try {
            await go().SetPhoneCanChange(p3.id, !p3.canChange);
          } catch (e3) {
            showError(e3);
          }
          loadPhones();
        } }, p3.canChange ? "Make read-only" : "Allow changes"),
        h2("button", { class: "small", title: "Unpair it: it stops working at once", onclick: async () => {
          try {
            await go().RemovePhone(p3.id);
          } catch (e3) {
            showError(e3);
          }
          loadPhones();
        } }, "Remove")
      ))) : "",
      h2(
        "div",
        { class: "inputrow pairrow" },
        name,
        h2("label", { class: "check" }, canChange, " Can make changes"),
        h2("button", { class: "small", id: "pairPhone", onclick: async () => {
          try {
            showPairing(await go().PairPhone(name.value, canChange.checked));
          } catch (e3) {
            showError(e3);
          }
        } }, "Pair a phone")
      ),
      h2("div", { id: "pairing", hidden: true })
    );
  }
  async function loadPeople() {
    const card = $2("peopleCard");
    let list2, st;
    try {
      [list2, st] = await Promise.all([go().People(), go().Status()]);
    } catch {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    const byId = Object.fromEntries(st.apps.map((a3) => [a3.id, a3]));
    const pocket = byId["pocket-id"]?.state === "running";
    const active = list2.filter((p3) => !p3.removed || p3.removed.startsWith("0001"));
    const head = h2("div", { class: "row" }, h2("h2", {}, "People"), h2("span", { class: "muted" }, active.length ? `${active.length} in the household` : "just you so far"));
    const why = h2("p", { class: "muted" }, "Each person gets one sign-in for the apps (with a passkey, no password to remember) and a welcome page with their apps and the phone apps to install.");
    if (!pocket) {
      card.replaceChildren(head, why, h2(
        "div",
        { class: "row" },
        h2("span", { class: "muted" }, "Adding people uses Pocket ID, the household’s sign-in."),
        h2("button", { class: "small", id: "installPocket", onclick: () => {
          selected.add("pocket-id");
          navigated = true;
          show("choose");
          renderApps();
          replan();
        } }, "Install Pocket ID")
      ));
      return;
    }
    const catOf = Object.fromEntries((catalog?.apps || []).map((x2) => [x2.id, x2]));
    const personal = st.apps.filter((a3) => a3.state === "running" && (a3.address || a3.url) && a3.id !== "homepage" && catOf[a3.id]?.kind !== "helper" && (!["network", "system", "security"].includes(catOf[a3.id]?.category) || a3.id === "vaultwarden"));
    const name = h2("input", { id: "personName", placeholder: "Name, e.g. Anna Smith", autocomplete: "off", spellcheck: "false" });
    const email = h2("input", { id: "personEmail", type: "email", placeholder: "Email (optional)", autocomplete: "off", spellcheck: "false" });
    const picks = personal.map((a3) => h2("label", { class: "check" }, h2("input", { type: "checkbox", value: a3.id }), " ", a3.name));
    const log = h2("pre", { id: "peopleLog", hidden: true });
    const run = async (button, action, who, mail = "", apps = []) => {
      button.disabled = true;
      log.hidden = false;
      log.textContent = "";
      const off = window.runtime.EventsOn("cli:log", (line) => {
        log.textContent += line + "\n";
        log.scrollTop = log.scrollHeight;
      });
      let ok = true;
      try {
        await go().PersonAction(action, who, mail, apps);
      } catch (e3) {
        ok = false;
        showError(e3);
      }
      if (typeof off === "function") off();
      button.disabled = false;
      return ok;
    };
    card.replaceChildren(
      head,
      why,
      active.length ? h2("ul", { class: "alertlist" }, active.map((p3) => h2(
        "li",
        {},
        h2("span", { class: "dot ok" }),
        h2("div", { class: "grow" }, h2("strong", {}, p3.name), h2("div", { class: "muted" }, [p3.email, (p3.apps || []).length ? `${p3.apps.length} app${p3.apps.length === 1 ? "" : "s"}` : "every app"].filter(Boolean).join(" · "))),
        h2("button", { class: "small", title: "Open their welcome page, to print or send", onclick: () => go().OpenWelcome(p3.username).catch(showError) }, "Welcome page"),
        h2("button", { class: "small", title: "A new sign-in link (the old one stops working) and a fresh welcome page", onclick: async (e3) => {
          if (await run(e3.target, "welcome", p3.username)) go().OpenWelcome(p3.username).catch(showError);
        } }, "New sign-in link"),
        h2("button", { class: "small danger", title: "Turn their sign-in off; their photos, documents, and the rest stay", onclick: async (e3) => {
          if (e3.target.dataset.sure !== "1") {
            e3.target.dataset.sure = "1";
            e3.target.textContent = "Click again to remove";
            return;
          }
          if (await run(e3.target, "remove", p3.username)) loadPeople();
        } }, "Remove")
      ))) : "",
      h2(
        "details",
        { class: "addperson", open: !active.length },
        h2("summary", {}, h2("strong", {}, "Add a person")),
        h2("div", { class: "inputrow" }, name, email),
        picks.length ? h2("div", { class: "picks" }, h2("div", { class: "muted small" }, "The apps they use (none ticked: all of them)"), picks) : "",
        h2("button", { class: "small primary", id: "addPerson", onclick: async (e3) => {
          if (!name.value.trim()) {
            name.focus();
            return;
          }
          const apps = picks.map((l3) => l3.querySelector("input")).filter((i3) => i3.checked).map((i3) => i3.value);
          if (await run(e3.target, "add", name.value.trim(), email.value.trim(), apps)) {
            const added = (await go().People()).find((p3) => p3.name === name.value.trim());
            if (added) go().OpenWelcome(added.username).catch(() => {
            });
            loadPeople();
          }
        } }, "Add them")
      ),
      log
    );
  }
  function showPairing(p3) {
    const box = $2("pairing");
    box.hidden = false;
    box.replaceChildren(h2(
      "div",
      { class: "pairing" },
      p3.qr ? h2("img", { src: p3.qr, alt: "QR code for pairing", width: 180, height: 180 }) : "",
      h2(
        "div",
        {},
        h2("p", {}, "Scan this with the phone’s camera, or open a link on the phone, then tap ", h2("strong", {}, "Pair"), ". The code is ", h2("code", {}, p3.code), " and works once, for 10 minutes."),
        h2("ul", {}, (p3.links || []).map((l3) => h2("li", {}, h2("code", {}, l3)))),
        p3.off ? h2("p", { class: "bad" }, "The phone companion is off (PHONE_COMPANION=false): turn it on below and save first.") : "",
        h2("p", { class: "muted" }, "Then, in Safari: Share › Add to Home Screen."),
        h2("button", { class: "small", onclick: () => {
          box.hidden = true;
          loadPhones();
        } }, "Done")
      )
    ));
  }
  async function loadSettings(focus = []) {
    loadPhones();
    loadPeople();
    let list2;
    try {
      list2 = await go().Settings();
    } catch (e3) {
      $2("settingsForm").replaceChildren(h2("p", { class: "bad" }, String(e3)));
      return;
    }
    for (const k3 of Object.keys(changed)) delete changed[k3];
    markChanged();
    if (!testable) {
      try {
        testable = new Set(await go().SettingTests());
      } catch {
        testable = /* @__PURE__ */ new Set();
      }
    }
    const checks = {};
    for (const s3 of lastSteps) for (const k3 of s3.settings || []) checks[k3] = s3;
    const pages = settingsPages(list2);
    const wanted = /* @__PURE__ */ new Set([...everyday, ...(catalog?.apps || []).flatMap((a3) => a3.inputs || []), ...Object.keys(checks), ...focus]);
    everydayCount = list2.filter((s3) => wanted.has(s3.key)).length;
    moreCount = list2.length - everydayCount;
    $2("settingsForm").replaceChildren(...pages.map((pg) => h2(
      "div",
      { class: "group", "data-page": pg.name, "data-kind": pg.kind },
      h2("h2", {}, pg.name),
      pg.items.map((s3) => {
        const step = checks[s3.key];
        const result = h2("div", { class: "test", hidden: true });
        const toggle = !s3.secret && /^(true|false)$/i.test(s3.value || "");
        const input = toggle ? h2("input", {
          type: "checkbox",
          class: "switch",
          role: "switch",
          checked: /^true$/i.test(s3.value),
          "aria-label": settingLabel(s3.key),
          onchange: (e3) => {
            changed[s3.key] = e3.target.checked ? "true" : "false";
            markChanged();
          }
        }) : h2("input", {
          type: s3.secret ? "password" : "text",
          autocomplete: "off",
          spellcheck: "false",
          value: s3.secret ? "" : s3.value || "",
          "aria-label": settingLabel(s3.key),
          placeholder: s3.secret ? s3.set ? "set · leave empty to keep" : "not set" : "",
          oninput: (e3) => {
            changed[s3.key] = e3.target.value;
            markChanged();
          }
        });
        const test = testable.has(s3.key) ? h2("button", { class: "small", title: "Check the saved value with the service it is for", onclick: (e3) => testSetting(s3.key, e3.target, result) }, "Test") : null;
        const copy = s3.secret && s3.set ? h2("button", { class: "small", title: "Copy the saved value, to keep it in the password manager; the clipboard clears after 90 seconds", onclick: (e3) => copySetting(s3.key, e3.target, result) }, "Copy") : null;
        const choose = !s3.secret && folderKey.test(s3.key) ? h2("button", { class: "small", title: "Pick the folder", onclick: async () => {
          try {
            const dir = await go().ChooseFolder(s3.key);
            if (dir) {
              input.value = dir;
              changed[s3.key] = dir;
              markChanged();
            }
          } catch (e3) {
            showError(e3);
          }
        } }, "Choose…") : null;
        const row = h2(
          "div",
          { class: "setting" + (focus.includes(s3.key) ? " focus" : "") + (wanted.has(s3.key) ? "" : " more"), id: "setting-" + s3.key },
          h2("div", { class: "key" }, h2("span", { class: "label" }, settingLabel(s3.key)), h2("code", {}, s3.key)),
          test || copy || choose ? h2("div", { class: "inputrow" }, input, choose, copy, test) : input,
          result,
          s3.help ? h2("div", { class: "help" }, s3.help) : null,
          step && step.state !== "waiting" ? h2(
            "div",
            { class: "check " + (step.state === "done" ? "ok" : "warn") },
            step.state === "done" ? `✓ ${step.title}` : `${step.title}: ${step.detail || "to do"}`
          ) : null
        );
        return row;
      })
    )));
    if (focus.length) settingsPage = pages.find((pg) => pg.items.some((s3) => s3.key === focus[0]))?.name || settingsPage;
    if (!pages.some((pg) => pg.name === settingsPage) && !extraPages.includes(settingsPage)) settingsPage = pages[0]?.name || "";
    renderSettingsNav(pages);
    filterSettings();
    if (focus.length) document.getElementById("setting-" + focus[0])?.scrollIntoView({ block: "center" });
  }
  var settingsPage = "";
  var extraPages = ["People", "Phones"];
  function settingsPages(list2) {
    const norm = (t3) => t3.toUpperCase().replace(/[^A-Z0-9]+/g, "_") + "_";
    const apps = (catalog?.apps || []).map((a3) => ({
      name: a3.name,
      inputs: new Set(a3.inputs || []),
      helper: a3.kind === "helper",
      stack: a3.stack,
      prefixes: [[norm(a3.id), 0], [norm(a3.name), 2], [norm(a3.id.split("-")[0]), 1]]
    }));
    const main = (a3) => a3 && a3.helper && a3.stack && apps.find((b2) => !b2.helper && b2.stack === a3.stack) || a3;
    const appOf = (key) => main(findApp(key));
    const findApp = (key) => {
      const own = apps.find((a3) => a3.inputs.has(key));
      if (own) return own;
      let best = null, score = 0;
      for (const a3 of apps) {
        for (const [p3, bonus] of a3.prefixes) {
          const sc = key.startsWith(p3) ? p3.length * 10 + bonus + (a3.helper ? 0 : 3) : 0;
          if (sc > score) {
            best = a3;
            score = sc;
          }
        }
      }
      return best;
    };
    const perApp = (name) => /^App (ports|settings)/.test(name);
    const general = [], byApp = /* @__PURE__ */ new Map();
    const page = (name, kind) => {
      if (kind === "general") {
        let p3 = general.find((g2) => g2.name === name);
        if (!p3) general.push(p3 = { name, kind, items: [] });
        return p3;
      }
      const known = [...byApp.keys()].find((n2) => n2 === name || n2.startsWith(name + " "));
      if (!byApp.has(known || name)) byApp.set(name, { name, kind, items: [] });
      return byApp.get(known || name);
    };
    for (const s3 of list2) {
      if (!perApp(s3.section)) {
        const isApp = apps.some((a4) => s3.section === a4.name || s3.section.startsWith(a4.name + " "));
        page(s3.section === "This Mac" ? thisMachine : s3.section, isApp ? "app" : "general").items.push(s3);
        continue;
      }
      const a3 = appOf(s3.key);
      page(a3 ? a3.name : "Other apps", "app").items.push(s3);
    }
    const appPages = [...byApp.values()].sort((a3, b2) => Number(a3.name === "Other apps") - Number(b2.name === "Other apps") || a3.name.localeCompare(b2.name));
    return [...general, ...appPages];
  }
  function renderSettingsNav(pages) {
    const installed = (name) => Object.values(statusById || {}).some((a3) => a3.name === name && a3.state !== "missing");
    const item = (name) => h2("button", { class: "pagebtn", "data-page": name, onclick: () => {
      settingsPage = name;
      $2("settingsSearch").value = "";
      filterSettings();
      document.querySelector("main").scrollTo({ top: 0 });
    } }, h2("span", {}, name), h2("span", { class: "n" }));
    const general = pages.filter((p3) => p3.kind === "general");
    const apps = pages.filter((p3) => p3.kind === "app");
    const known = Object.keys(statusById || {}).length > 0;
    const mine = known ? apps.filter((p3) => installed(p3.name) || p3.name === "Other apps") : apps;
    const others = known ? apps.filter((p3) => !mine.includes(p3)) : [];
    $2("settingsNav").replaceChildren(
      h2("div", { class: "navhead" }, "General"),
      ...general.map((p3) => item(p3.name)),
      ...extraPages.map((n2) => item(n2)),
      ...mine.length ? [h2("div", { class: "navhead" }, "Apps"), ...mine.map((p3) => item(p3.name))] : [],
      ...others.length ? [h2("div", { class: "navhead" }, "Not installed"), ...others.map((p3) => item(p3.name))] : []
    );
  }
  var everyday = /* @__PURE__ */ new Set([
    "TZ",
    "HOMELAB_DOMAIN",
    "MEDIA_ROOT",
    "DOWNLOADS_ROOT",
    "IMMICH_UPLOAD_LOCATION",
    "BACKUP_DESTINATION",
    "JELLYFIN_DATA_DIR",
    "SYNC_ROOT",
    "KEEP_AWAKE",
    "BATTERY_SAVER",
    "PHONE_COMPANION",
    "AUTO_DOMAIN",
    "CLOUDFLARE_API_TOKEN",
    "TUNNEL_TOKEN",
    "ADGUARD_USER",
    "ADGUARD_PASSWORD",
    "HELPER_EMAIL",
    "HEARTBEAT_URL",
    "DESKTOP_ALERTS",
    "UPDATES_PAUSED",
    "AUTO_ROLLBACK",
    "UPDATE_CHANNEL",
    "VAULTWARDEN_SIGNUPS_ALLOWED",
    "DUPLICATI_SECRETS_PASSPHRASE",
    "NTFY_PHONE_PASSWORD",
    "TAILSCALE_AUTHKEY",
    "PROTONVPN_WIREGUARD_PRIVATE_KEY",
    "PROTONVPN_SERVER_COUNTRIES",
    "QBITTORRENT_PASSWORD",
    "CROWDSEC_ENROLL_KEY",
    "ROMM_IGDB_CLIENT_ID",
    "ROMM_IGDB_CLIENT_SECRET",
    "ROMM_SCREENSCRAPER_USER",
    "ROMM_SCREENSCRAPER_PASSWORD"
  ]);
  var everydayCount = 0;
  var moreCount = 0;
  var settingsShowAll = false;
  $2("settingsAll").onclick = () => {
    settingsShowAll = !settingsShowAll;
    filterSettings();
  };
  var settingLabels = {
    TZ: "Time zone",
    PUID: "User ID",
    PGID: "Group ID",
    BIND_IP: "Apps listen on",
    LAN_BIND_IP: "Proxy and DNS listen on",
    KEEP_AWAKE: "Keep this machine awake",
    BATTERY_SAVER: "Battery saver",
    MEDIA_ROOT: "Media drive",
    DOWNLOADS_ROOT: "Downloads folder",
    IMMICH_UPLOAD_LOCATION: "Photos folder",
    BACKUP_DESTINATION: "Backups go to",
    JELLYFIN_DATA_DIR: "Jellyfin data folder",
    SYNC_ROOT: "Syncthing folder",
    HOMELAB_DOMAIN: "Domain (empty: addresses on your tailnet)",
    HOMELAB_BASELINE: "Apps that always start (small or full)",
    AUTO_DOMAIN: "Give new apps their addresses",
    CLOUDFLARE_API_TOKEN: "Cloudflare API token",
    TUNNEL_TOKEN: "Tunnel token",
    DESKTOP_ALERTS: "Alerts on this screen",
    HELPER_EMAIL: "Your helper's email",
    HEARTBEAT_URL: "Heartbeat ping URL",
    UPDATES_PAUSED: "Pause nightly updates",
    VAULTWARDEN_SIGNUPS_ALLOWED: "Vaultwarden sign-ups open",
    TAILSCALE_AUTHKEY: "Tailscale auth key (optional)",
    TAILSCALE_HOST: "This machine on the tailnet",
    TAILNET_ADMIN_APPS: "Admin apps on the tailnet",
    PROTONVPN_WIREGUARD_PRIVATE_KEY: "ProtonVPN WireGuard key",
    PROTONVPN_SERVER_COUNTRIES: "ProtonVPN server countries"
  };
  var upper = /* @__PURE__ */ new Set(["NPM", "API", "URL", "DNS", "IP", "HTTP", "HTTPS", "ID", "PDF", "AI", "IGDB", "SSL", "UI"]);
  function settingLabel(key) {
    if (settingLabels[key]) return settingLabels[key];
    const words = key.split("_").map((w3) => upper.has(w3) ? w3 : w3.toLowerCase());
    const text = words.join(" ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  function markChanged() {
    const n2 = Object.keys(changed).length;
    $2("saveSettings").hidden = n2 === 0;
    $2("saveSettings").textContent = n2 === 1 ? "Save 1 change" : `Save ${n2} changes`;
  }
  function filterSettings() {
    const words = $2("settingsSearch").value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0, pageMore = 0;
    const counts = {};
    for (const group of $2("settingsForm").querySelectorAll(".group")) {
      const name = group.dataset.page, here = name === settingsPage, general = group.dataset.kind === "general";
      const section = name.toLowerCase();
      let any = false;
      for (const row of group.querySelectorAll(".setting")) {
        const text = section + " " + row.textContent.toLowerCase().replace(/_/g, " ") + " " + row.id.toLowerCase();
        const more = general && row.classList.contains("more");
        if (here && more) pageMore++;
        const match = words.length ? words.every((w3) => text.includes(w3)) : here && (settingsShowAll || !more);
        row.hidden = !match;
        any = any || match;
        if (match) {
          shown++;
          counts[name] = (counts[name] || 0) + 1;
        }
      }
      group.hidden = !any;
      group.querySelector("h2").hidden = !words.length;
    }
    for (const [id, name] of [["peopleCard", "People"], ["phonesCard", "Phones"]]) $2(id).classList.toggle("offpage", !!words.length || settingsPage !== name);
    for (const b2 of $2("settingsNav").querySelectorAll(".pagebtn")) {
      b2.classList.toggle("active", !words.length && b2.dataset.page === settingsPage);
      b2.classList.toggle("nomatch", !!words.length && !counts[b2.dataset.page]);
      b2.querySelector(".n").textContent = words.length && counts[b2.dataset.page] ? String(counts[b2.dataset.page]) : "";
    }
    $2("settingsNone").hidden = shown > 0 || !words.length;
    $2("settingsAll").hidden = !!words.length || !pageMore;
    $2("settingsAll").textContent = settingsShowAll ? "Show the everyday settings only" : `Show all settings (${pageMore} more)`;
  }
  $2("settingsSearch").oninput = filterSettings;
  var folderKey = /(_ROOT|_DESTINATION|_LOCATION|_DIR)$/;
  async function copySetting(key, button, out) {
    out.hidden = false;
    try {
      await go().CopySetting(key);
      out.className = "test ok";
      out.textContent = "✓ Copied. Paste it into Vaultwarden; the clipboard clears in 90 seconds.";
    } catch (e3) {
      out.className = "test bad";
      out.textContent = String(e3 && e3.message || e3);
    }
  }
  async function testSetting(key, button, out) {
    out.hidden = false;
    button.disabled = true;
    if (key in changed) {
      const input = $1(`#setting-${key} input`);
      if (!(input?.type === "password" && changed[key] === "")) {
        try {
          await go().SaveSettings({ [key]: changed[key] });
        } catch (e3) {
          out.className = "test bad";
          out.textContent = String(e3 && e3.message || e3);
          button.disabled = false;
          return;
        }
      }
      delete changed[key];
      markChanged();
    }
    out.className = "test muted";
    out.textContent = "Testing…";
    try {
      const r3 = await go().TestSetting(key);
      out.className = "test " + (r3.ok ? "ok" : "bad");
      out.textContent = (r3.ok ? "✓ " : "✗ ") + r3.message;
    } catch (e3) {
      out.className = "test bad";
      out.textContent = String(e3 && e3.message || e3);
    }
    button.disabled = false;
  }
  function showSettings(keys) {
    show("settings");
    loadSettings(keys);
  }
  $2("saveSettings").onclick = async () => {
    const values = {};
    for (const [k3, v3] of Object.entries(changed)) {
      const input = $1(`#setting-${k3} input`);
      if (input?.type === "password" && v3 === "") continue;
      values[k3] = v3;
    }
    try {
      await go().SaveSettings(values);
      lastSteps = await go().Setup();
      await loadSettings(Object.keys(values));
    } catch (e3) {
      showError(e3);
    }
  };
  $2("phoneReport").onclick = async (e3) => {
    const btn = e3.target;
    btn.disabled = true;
    btn.textContent = "Making the report…";
    try {
      const r3 = await go().Report();
      const file = new File([r3.text], "homelab-report.txt", { type: "text/plain" });
      const text = "My homelab needs a look. The report has every password and token removed.";
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Homelab report", text });
      } else {
        const a3 = h2("a", { href: URL.createObjectURL(file), download: file.name });
        a3.click();
        if (r3.helper) location.href = "mailto:" + encodeURIComponent(r3.helper) + "?subject=" + encodeURIComponent("Homelab report") + "&body=" + encodeURIComponent(text + " The file is attached.");
      }
    } catch (err) {
      if (err && err.name !== "AbortError") showError(err);
    }
    btn.disabled = false;
    btn.textContent = "Send a report";
  };
  window.addEventListener("load", async () => {
    window.runtime.EventsOn("navigate", (screen) => {
      navigated = true;
      show(screen);
    });
    window.runtime.EventsOn("status:changed", refreshStatus);
    window.runtime.EventsOn("cli:step", cliProgress);
    window.runtime.EventsOn("refresh", () => {
      const current = document.querySelector(".screen.active")?.id;
      if (current) show(current);
    });
    try {
      const info = await loadHost();
      if (!info.rootOK) return show("setup");
      await loadCatalog();
      const screen = await go().Screen();
      if (screen) return show(screen);
      const steps = await go().Setup();
      const left = steps.filter((s3) => s3.state !== "done").length;
      setupBadge(left);
      if (left && !navigated) show("setup");
    } catch (e3) {
      showError(e3);
      show("setup");
    }
  });
})();
