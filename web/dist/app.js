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
    var s3, h4, p3, v3, y3, _2, g2 = t3 && t3.__k || w, m3 = l3.length;
    for (f4 = T(u4, l3, g2, f4, m3), s3 = 0; s3 < m3; s3++) null != (p3 = u4.__k[s3]) && (h4 = -1 != p3.__i && g2[p3.__i] || d, p3.__i = s3, _2 = q(n2, p3, h4, i3, r3, o3, e3, f4, c3, a3), v3 = p3.__e, p3.ref && h4.ref != p3.ref && (h4.ref && J(h4.ref, null, p3), a3.push(p3.ref, p3.__c || v3, p3)), null == y3 && null != v3 && (y3 = v3), 4 & p3.__u ? (f4 = j(p3, f4, n2), h4.__e && (h4.__e = null)) : "function" == typeof p3.type && void 0 !== _2 ? f4 = _2 : v3 && (f4 = v3.nextSibling), p3.__u &= -7);
    return u4.__e = y3, f4;
  }
  function T(n2, l3, u4, t3, i3) {
    var r3, o3, e3, f4, c3, a3 = u4.length, s3 = a3, h4 = 0;
    for (n2.__k = new Array(i3), r3 = 0; r3 < i3; r3++) null != (o3 = l3[r3]) && "boolean" != typeof o3 && "function" != typeof o3 ? ("string" == typeof o3 || "number" == typeof o3 || "bigint" == typeof o3 || o3.constructor == String ? o3 = n2.__k[r3] = x(null, o3, null, null, null) : g(o3) ? o3 = n2.__k[r3] = x(S, { children: o3 }, null, null, null) : void 0 === o3.constructor && o3.__b > 0 ? o3 = n2.__k[r3] = x(o3.type, o3.props, o3.key, o3.ref ? o3.ref : null, o3.__v) : n2.__k[r3] = o3, f4 = r3 + h4, o3.__ = n2, o3.__b = n2.__b + 1, e3 = null, -1 != (c3 = o3.__i = O(o3, u4, f4, s3)) && (s3--, (e3 = u4[c3]) && (e3.__u |= 2)), null == e3 || null == e3.__v ? (-1 == c3 && (i3 > a3 ? h4-- : i3 < a3 && h4++), "function" != typeof o3.type && (o3.__u |= 4)) : c3 != f4 && (c3 == f4 - 1 ? h4-- : c3 == f4 + 1 ? h4++ : (c3 > f4 ? h4-- : h4++, o3.__u |= 4))) : n2.__k[r3] = null;
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
    var s3, h4, p3, v3, y3, d3, _2, k3, x2, M, I2, P2, A2, H2, T2, j3, F = u4.type;
    if (void 0 !== u4.constructor) return null;
    128 & t3.__u && (c3 = !!(32 & t3.__u), o3 = [f4 = u4.__e = t3.__e]), (s3 = l.__b) && s3(u4);
    n: if ("function" == typeof F) {
      h4 = e3.length;
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
        if (e3.length = h4, u4.__v = null, c3 || null != o3) {
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
    var s3, h4, p3, v3, y3, w3, _2, m3 = i3.props || d, k3 = t3.props, x2 = t3.type;
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
      for (s3 in k3) y3 = k3[s3], "children" == s3 ? v3 = y3 : "dangerouslySetInnerHTML" == s3 ? h4 = y3 : "value" == s3 ? w3 = y3 : "checked" == s3 ? _2 = y3 : c3 && "function" != typeof y3 || m3[s3] === y3 || N(u4, s3, y3, m3[s3], o3);
      if (h4) c3 || p3 && (h4.__html == p3.__html || h4.__html == u4.innerHTML) || (u4.innerHTML = h4.__html), t3.__k = [];
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
  function h2(n2, u4) {
    var i3 = s2(t2++, 3);
    !c2.__s && C2(i3.__H, u4) && (i3.__ = n2, i3.u = u4, r2.__H.__h.push(i3));
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
  function C2(n2, t3) {
    return !n2 || n2.length !== t3.length || t3.some(function(t4, r3) {
      return t4 !== n2[r3];
    });
  }
  function D2(n2, t3) {
    return "function" == typeof t3 ? t3(n2) : t3;
  }

  // web/src/format.ts
  var dollars = (v3) => "$" + Math.round(v3).toLocaleString("en-US");
  var never = (t3) => !t3 || t3.startsWith("0001-");
  function ago(t3) {
    if (never(t3)) return "never";
    const mins = Math.max(0, Math.round((Date.now() - new Date(t3).getTime()) / 6e4));
    if (mins < 60) return mins <= 1 ? "just now" : `${mins} minutes ago`;
    const hours = Math.round(mins / 60);
    if (hours < 36) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? "yesterday" : `${days} days ago`;
  }
  function untilText(t3) {
    const mins = Math.round((new Date(t3).getTime() - Date.now()) / 6e4);
    if (mins <= 1) return "now";
    if (mins < 60) return `in ${mins} minutes`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours === 1 ? "in an hour" : `in ${hours} hours`;
    const days = Math.round(hours / 24);
    return days === 1 ? "tomorrow" : `in ${days} days`;
  }

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
  function Spark({ values, w: w3 = 96, h: h4 = 24, title }) {
    const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
    const points = values.map((v3, i3) => `${(i3 / Math.max(1, values.length - 1) * w3).toFixed(1)},${(h4 - 2 - (v3 - lo) / span * (h4 - 4)).toFixed(1)}`).join(" ");
    return /* @__PURE__ */ u3("svg", { class: "spark", viewBox: `0 0 ${w3} ${h4}`, role: title ? "img" : void 0, "aria-label": title, children: /* @__PURE__ */ u3("polyline", { points, fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linejoin": "round", "stroke-linecap": "round" }) });
  }

  // web/src/status/Tiles.tsx
  function Tile({ label, value, sub, tone, id, title }) {
    return /* @__PURE__ */ u3("div", { id, title, class: "card tile" + (tone ? " " + tone : ""), children: [
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

  // web/src/icons.ts
  var icons = {
    restart: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    update: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    start: '<polygon points="6 3 20 12 6 21 6 3"/>',
    logs: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    rollback: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    phone: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    photos: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    film: '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'
  };

  // web/src/Icon.tsx
  function Icon({ name }) {
    return /* @__PURE__ */ u3("svg", { class: "icon", viewBox: "0 0 24 24", dangerouslySetInnerHTML: { __html: icons[name] } });
  }

  // web/src/choose/Choose.tsx
  var starterLooks = { photos: ["photos", "#ff9500"], passwords: ["lock", "#34c759"], movies: ["film", "#ff3b30"], music: ["music", "#ff2d55"], files: ["folder", "#007aff"] };
  var lit = (p3, selected2) => !!p3.apps.length && p3.apps.every((id) => selected2.has(id));
  function Starters({ presets, selected: selected2, status, toggle }) {
    return /* @__PURE__ */ u3(S, { children: presets.map((p3) => {
      const running = p3.apps.every((id) => status[id]?.state === "running");
      const [glyph, tint] = starterLooks[p3.id] || [];
      return /* @__PURE__ */ u3("button", { class: "starter" + (lit(p3, selected2) ? " on" : ""), onClick: () => toggle(p3), children: [
        glyph && /* @__PURE__ */ u3("span", { class: "glyph", style: `--tint:${tint}`, children: /* @__PURE__ */ u3(Icon, { name: glyph }) }),
        /* @__PURE__ */ u3("strong", { children: p3.name }),
        /* @__PURE__ */ u3("span", { class: "desc", children: p3.description || "" }),
        running && /* @__PURE__ */ u3("span", { class: "state", children: "Running" })
      ] }, p3.id);
    }) });
  }
  function Bundles({ presets, selected: selected2, toggle }) {
    return /* @__PURE__ */ u3(S, { children: presets.map((p3) => /* @__PURE__ */ u3("button", { class: "chip" + (lit(p3, selected2) ? " on" : ""), title: p3.description || "", onClick: () => toggle(p3), children: p3.name }, p3.id)) });
  }
  var matches = (a3, query2) => !query2 || [a3.name, a3.id, a3.description, ...a3.replaces || [], ...a3.aliases || []].join(" ").toLowerCase().includes(query2);
  var stateBadge = { running: ["running", "ok"], stopped: ["stopped", "warn"], elsewhere: ["runs elsewhere", "warn"] };
  function AppRow({ a: a3, p: p3 }) {
    const native = a3.kind === "native";
    const st = p3.status[a3.id];
    const [stateText, stateCls] = st && stateBadge[st.state] || [];
    const target = st?.state === "running" ? st.address ? "https://" + st.address : st.url : "";
    const quiet = (fn) => (e3) => {
      e3.preventDefault();
      e3.stopPropagation();
      fn();
    };
    const links = [
      target && /* @__PURE__ */ u3("a", { onClick: quiet(() => p3.open(target)), children: "Open" }),
      !!a3.inputs?.length && /* @__PURE__ */ u3("a", { onClick: quiet(() => p3.settings(a3.inputs)), children: "Settings" })
    ].filter(Boolean);
    return /* @__PURE__ */ u3("label", { class: "app", children: [
      /* @__PURE__ */ u3("input", { type: "checkbox", checked: p3.selected.has(a3.id), disabled: native, onChange: (e3) => p3.tick(a3.id, e3.currentTarget.checked) }),
      /* @__PURE__ */ u3("div", { class: "grow", children: [
        /* @__PURE__ */ u3("strong", { children: a3.name }),
        native && /* @__PURE__ */ u3("span", { class: "badge", children: "runs natively" }),
        stateText && /* @__PURE__ */ u3("span", { class: "badge " + stateCls, children: stateText }),
        /* @__PURE__ */ u3("div", { class: "desc", children: a3.description }),
        !!a3.replaces?.length && /* @__PURE__ */ u3("div", { class: "replaces", children: [
          "Replaces ",
          a3.replaces.join(", ")
        ] })
      ] }),
      !!links.length && /* @__PURE__ */ u3("div", { class: "links-inline", children: links })
    ] });
  }
  function Groups(p3) {
    const byCategory = {};
    for (const a3 of p3.catalog.apps) if (a3.kind !== "helper" && matches(a3, p3.query)) (byCategory[a3.category] ??= []).push(a3);
    if (p3.query && !Object.keys(byCategory).length) return /* @__PURE__ */ u3("p", { class: "muted empty", children: [
      "No app matches “",
      p3.query,
      "”. Add your own below."
    ] });
    return /* @__PURE__ */ u3(S, { children: p3.catalog.categories.filter((c3) => byCategory[c3.id]).map((c3) => {
      const apps = byCategory[c3.id];
      const running = apps.filter((a3) => p3.status[a3.id]?.state === "running").length;
      return /* @__PURE__ */ u3("div", { class: "group", children: [
        /* @__PURE__ */ u3("h2", { children: [
          c3.label,
          /* @__PURE__ */ u3("span", { class: "n", children: [
            running,
            " of ",
            apps.length,
            " running"
          ] })
        ] }),
        apps.map((a3) => /* @__PURE__ */ u3(AppRow, { a: a3, p: p3 }, a3.id))
      ] }, c3.id);
    }) });
  }
  var plural = (n2, one, many) => `${n2} ${n2 === 1 ? one : many}`;
  function List({ title, items, cls }) {
    if (!items.length) return null;
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("h2", { children: title }),
      /* @__PURE__ */ u3("ul", { class: cls, children: items.map((i3, n2) => /* @__PURE__ */ u3("li", { children: i3 }, n2)) })
    ] });
  }
  function Plan({ plan: p3, appName: appName2, reason }) {
    if (p3 === null) return /* @__PURE__ */ u3(S, { children: "Nothing selected yet. Pick something to start with, or tick an app." });
    if (typeof p3 === "string") return /* @__PURE__ */ u3("p", { class: "bad", children: p3 });
    const picked = p3.start.filter((id) => !p3.added[id]);
    const helpers = p3.start.filter((id) => p3.added[id]);
    const running = p3.skips.filter((s3) => /^already running/.test(s3.reason));
    const quiet = p3.skips.filter((s3) => /^only needed by/.test(s3.reason));
    const needs = p3.skips.filter((s3) => !running.includes(s3) && !quiet.includes(s3));
    const lead = picked.length ? `Installs ${plural(picked.length, "app", "apps")}` + (helpers.length ? `, with ${plural(helpers.length, "helper", "helpers")} they need` : "") + "." : "";
    const details = [
      { title: "Helpers that start with them", items: helpers.map((id) => `${appName2(id)} (for ${appName2(p3.added[id])})`) },
      { title: "Port changes", items: p3.portChanges.map((c3) => `${c3.var}: ${c3.from} → ${c3.to} (${c3.reason})`) },
      { title: "Settings written", items: p3.envChanges.map((c3) => c3.secret ? `${c3.key} (hidden)` : `${c3.key} = ${c3.value}`) }
    ].filter((d3) => d3.items.length);
    return /* @__PURE__ */ u3(S, { children: [
      lead && /* @__PURE__ */ u3("p", { class: "planLead", children: lead }),
      !!picked.length && /* @__PURE__ */ u3("ul", { class: "ok planApps", children: picked.map((id) => /* @__PURE__ */ u3("li", { children: appName2(id) }, id)) }),
      /* @__PURE__ */ u3(List, { title: "Waiting for a setting", cls: "warn", items: needs.map((s3) => /* @__PURE__ */ u3("span", { children: [
        /* @__PURE__ */ u3("strong", { children: appName2(s3.app) }),
        ": ",
        reason(s3.reason)
      ] })) }),
      /* @__PURE__ */ u3(List, { title: "Problems", cls: "bad", items: p3.problems }),
      /* @__PURE__ */ u3(List, { title: "Worth knowing", cls: "warn", items: p3.warnings }),
      !!running.length && /* @__PURE__ */ u3("p", { class: "muted small", children: [
        "Already running: ",
        running.map((s3) => appName2(s3.app)).join(", "),
        "."
      ] }),
      !!details.length && /* @__PURE__ */ u3("details", { class: "planDetails", children: [
        /* @__PURE__ */ u3("summary", { class: "muted", children: "Details" }),
        details.map((d3) => /* @__PURE__ */ u3(List, { title: d3.title, items: d3.items }, d3.title))
      ] }),
      !p3.start.length && /* @__PURE__ */ u3("p", { id: "nothingToInstall", class: "muted", children: needs.length ? "Fill in the settings below to install the rest." : "Nothing left to install: everything you picked is already running." })
    ] });
  }
  function Inputs({ keys, meta, values, label, input }) {
    return /* @__PURE__ */ u3(S, { children: [
      !!keys.length && /* @__PURE__ */ u3("h2", { children: "Settings they need" }),
      keys.map((k3) => {
        const m3 = meta[k3] || {};
        const secret = m3.secret ?? /KEY|TOKEN|PASS|SECRET/.test(k3);
        return /* @__PURE__ */ u3("label", { class: "field", children: [
          /* @__PURE__ */ u3("span", { class: "fieldName", children: label(k3) }),
          /* @__PURE__ */ u3(
            "input",
            {
              type: secret ? "password" : "text",
              value: values[k3] || "",
              autocomplete: "off",
              spellcheck: false,
              placeholder: m3.set ? "set already · leave empty to keep it" : "not set yet",
              onInput: (e3) => input(k3, e3.currentTarget.value)
            }
          ),
          m3.help && /* @__PURE__ */ u3("span", { class: "help", children: m3.help })
        ] }, k3);
      })
    ] });
  }
  var mountStarters = (el, props) => R(/* @__PURE__ */ u3(Starters, { ...props }), el);
  var mountBundles = (el, props) => R(/* @__PURE__ */ u3(Bundles, { ...props }), el);
  var mountGroups = (el, props) => R(/* @__PURE__ */ u3(Groups, { ...props }), el);
  var planned = /* @__PURE__ */ new WeakSet();
  var mountPlan = (el, props) => {
    if (!planned.has(el)) {
      el.replaceChildren();
      planned.add(el);
    }
    R(/* @__PURE__ */ u3(Plan, { ...props }), el);
  };
  var mountInputs = (el, props) => R(/* @__PURE__ */ u3(Inputs, { ...props }), el);
  var catalogProblem = (el, problem) => R(/* @__PURE__ */ u3("p", { class: "bad", children: problem }), el);

  // web/src/logs/Explain.tsx
  function Explain({ model, ask }) {
    const [busy, setBusy] = d2(false);
    const [answer, setAnswer] = d2("");
    const [problem, setProblem] = d2("");
    const go2 = async () => {
      setBusy(true);
      setProblem("");
      try {
        setAnswer(await ask());
      } catch (e3) {
        setProblem(String(e3?.message || e3));
      } finally {
        setBusy(false);
      }
    };
    return /* @__PURE__ */ u3("div", { class: "explain", children: [
      /* @__PURE__ */ u3("div", { class: "row", children: [
        /* @__PURE__ */ u3("button", { class: "small", disabled: busy, onClick: go2, children: busy ? "Reading the log…" : answer ? "Ask again" : "Explain this log" }),
        /* @__PURE__ */ u3("span", { class: "muted", children: [
          model.replace(/:latest$/, ""),
          ", on this machine: the log stays here"
        ] })
      ] }),
      answer && !busy && /* @__PURE__ */ u3("p", { class: "answer", children: answer }),
      problem && /* @__PURE__ */ u3("p", { class: "muted", children: problem })
    ] });
  }
  function mountExplain(el, props) {
    R(/* @__PURE__ */ u3(Explain, { ...props }), el);
  }

  // web/src/settings/Form.tsx
  var folderKey = /(_ROOT|_DESTINATION|_LOCATION|_DIR)$/;
  function shown(pages, view, wanted, label, checks) {
    const words = view.query.toLowerCase().split(/\s+/).filter(Boolean);
    const out = { keys: /* @__PURE__ */ new Set(), counts: {}, pageMore: 0 };
    for (const pg of pages) {
      const here = pg.name === view.page;
      for (const s3 of pg.items) {
        const more = pg.kind === "general" && !wanted.has(s3.key);
        if (here && more) out.pageMore++;
        const step = checks[s3.key];
        const text = [pg.name, label(s3.key), s3.key.replace(/_/g, " "), s3.help || "", step ? step.title : "", "setting-" + s3.key].join(" ").toLowerCase();
        const match = words.length ? words.every((w3) => text.includes(w3)) : here && (view.showAll || !more);
        if (match) {
          out.keys.add(s3.key);
          out.counts[pg.name] = (out.counts[pg.name] || 0) + 1;
        }
      }
    }
    return out;
  }
  function Row({ s: s3, p: p3, value, hidden, edit }) {
    const [result, setResult] = d2(null);
    const [testing, setTesting] = d2(false);
    const [kept, setKept] = d2(void 0);
    const step = p3.checks[s3.key];
    const toggle = !s3.secret && /^(true|false)$/i.test(s3.value || "");
    const label = p3.label(s3.key);
    const input = toggle ? /* @__PURE__ */ u3("input", { type: "checkbox", class: "switch", role: "switch", "aria-label": label, checked: /^true$/i.test(value ?? kept ?? s3.value), onChange: (e3) => edit(s3.key, e3.currentTarget.checked ? "true" : "false") }) : /* @__PURE__ */ u3(
      "input",
      {
        type: s3.secret ? "password" : "text",
        autocomplete: "off",
        spellcheck: false,
        "aria-label": label,
        value: value ?? kept ?? (s3.secret ? "" : s3.value || ""),
        placeholder: s3.secret ? s3.set ? "set · leave empty to keep" : "not set" : "",
        onInput: (e3) => edit(s3.key, e3.currentTarget.value)
      }
    );
    const test = async () => {
      setTesting(true);
      setResult({ tone: "muted", text: "Testing…" });
      const { result: r3, used } = await p3.on.test(s3.key, value);
      if (used) {
        if (!s3.secret) setKept(value);
        edit(s3.key, void 0);
      }
      setResult(r3);
      setTesting(false);
    };
    const buttons = [
      !s3.secret && folderKey.test(s3.key) && /* @__PURE__ */ u3("button", { class: "small", title: "Pick the folder", onClick: async () => {
        const dir = await p3.on.choose(s3.key);
        if (dir) edit(s3.key, dir);
      }, children: "Choose…" }),
      s3.secret && s3.set && /* @__PURE__ */ u3("button", { class: "small", title: "Copy the saved value, to keep it in the password manager; the clipboard clears after 90 seconds", onClick: async () => setResult(await p3.on.copy(s3.key)), children: "Copy" }),
      p3.testable.has(s3.key) && /* @__PURE__ */ u3("button", { class: "small", title: "Check the saved value with the service it is for", disabled: testing, onClick: test, children: "Test" })
    ].filter(Boolean);
    return /* @__PURE__ */ u3("div", { class: "setting" + (p3.focus.includes(s3.key) ? " focus" : "") + (p3.wanted.has(s3.key) ? "" : " more"), id: "setting-" + s3.key, hidden, children: [
      /* @__PURE__ */ u3("div", { class: "key", children: [
        /* @__PURE__ */ u3("span", { class: "label", children: label }),
        /* @__PURE__ */ u3("code", { children: s3.key })
      ] }),
      buttons.length ? /* @__PURE__ */ u3("div", { class: "inputrow", children: [
        input,
        buttons
      ] }) : input,
      /* @__PURE__ */ u3("div", { class: "test" + (result ? " " + result.tone : ""), hidden: !result, children: result?.text }),
      s3.help && /* @__PURE__ */ u3("div", { class: "help", children: s3.help }),
      step && step.state !== "waiting" && /* @__PURE__ */ u3("div", { class: "check " + (step.state === "done" ? "ok" : "warn"), children: step.state === "done" ? `✓ ${step.title}` : `${step.title}: ${step.detail || "to do"}` })
    ] });
  }
  function Form(p3) {
    const [edits, setEdits] = d2({});
    const edit = (key, value) => {
      setEdits((old) => {
        const next = { ...old };
        if (value === void 0) delete next[key];
        else next[key] = value;
        p3.on.edited(next);
        return next;
      });
    };
    const show2 = shown(p3.pages, p3.view, p3.wanted, p3.label, p3.checks);
    const searching = !!p3.view.query.trim();
    return /* @__PURE__ */ u3(S, { children: p3.pages.map((pg) => /* @__PURE__ */ u3("div", { class: "group", "data-page": pg.name, "data-kind": pg.kind, hidden: !show2.counts[pg.name], children: [
      /* @__PURE__ */ u3("h2", { hidden: !searching, children: pg.name }),
      pg.items.map((s3) => /* @__PURE__ */ u3(Row, { s: s3, p: p3, value: edits[s3.key], hidden: !show2.keys.has(s3.key), edit }, s3.key))
    ] }, pg.name)) });
  }
  function mountForm(el, props, version) {
    R(/* @__PURE__ */ u3(Form, { ...props }, version), el);
  }
  function formProblem(el, problem) {
    R(/* @__PURE__ */ u3("p", { class: "bad", children: problem }), el);
  }

  // web/src/settings/People.tsx
  var active = (p3) => !p3.removed || p3.removed.startsWith("0001");
  function Person({ p: p3, on }) {
    const [busy, setBusy] = d2("");
    const [sure, setSure] = d2(false);
    const run = async (action) => {
      setBusy(action);
      const ok = await on.act(action, p3.username);
      setBusy("");
      return ok;
    };
    const apps = p3.apps || [];
    return /* @__PURE__ */ u3("li", { children: [
      /* @__PURE__ */ u3("span", { class: "dot ok" }),
      /* @__PURE__ */ u3("div", { class: "grow", children: [
        /* @__PURE__ */ u3("strong", { children: p3.name }),
        /* @__PURE__ */ u3("div", { class: "muted", children: [p3.email, apps.length ? `${apps.length} app${apps.length === 1 ? "" : "s"}` : "every app"].filter(Boolean).join(" · ") })
      ] }),
      /* @__PURE__ */ u3("button", { class: "small", title: "Open their welcome page, to print or send", onClick: () => on.openWelcome(p3.username), children: "Welcome page" }),
      /* @__PURE__ */ u3(
        "button",
        {
          class: "small",
          title: "A new sign-in link (the old one stops working) and a fresh welcome page",
          disabled: busy === "welcome",
          onClick: async () => {
            if (await run("welcome")) on.openWelcome(p3.username);
          },
          children: "New sign-in link"
        }
      ),
      /* @__PURE__ */ u3(
        "button",
        {
          class: "small danger",
          title: "Turn their sign-in off; their photos, documents, and the rest stay",
          disabled: busy === "remove",
          onClick: async () => {
            if (!sure) {
              setSure(true);
              return;
            }
            if (await run("remove")) on.reload();
          },
          children: sure ? "Click again to remove" : "Remove"
        }
      )
    ] });
  }
  function AddPerson({ apps, open, on }) {
    const [name, setName] = d2("");
    const [email, setEmail] = d2("");
    const [picked, setPicked] = d2(/* @__PURE__ */ new Set());
    const [busy, setBusy] = d2(false);
    const toggle = (id, on2) => setPicked((s3) => {
      const n2 = new Set(s3);
      if (on2) n2.add(id);
      else n2.delete(id);
      return n2;
    });
    const add = async () => {
      const who = name.trim();
      if (!who) {
        document.getElementById("personName")?.focus();
        return;
      }
      setBusy(true);
      const ok = await on.act("add", who, email.trim(), apps.map((a3) => a3.id).filter((id) => picked.has(id)));
      setBusy(false);
      if (ok) on.added(who);
    };
    return /* @__PURE__ */ u3("details", { class: "addperson", open, children: [
      /* @__PURE__ */ u3("summary", { children: /* @__PURE__ */ u3("strong", { children: "Add a person" }) }),
      /* @__PURE__ */ u3("div", { class: "inputrow", children: [
        /* @__PURE__ */ u3("input", { id: "personName", placeholder: "Name, e.g. Anna Smith", autocomplete: "off", spellcheck: false, value: name, onInput: (e3) => setName(e3.currentTarget.value) }),
        /* @__PURE__ */ u3("input", { id: "personEmail", type: "email", placeholder: "Email (optional)", autocomplete: "off", spellcheck: false, value: email, onInput: (e3) => setEmail(e3.currentTarget.value) })
      ] }),
      !!apps.length && /* @__PURE__ */ u3("div", { class: "picks", children: [
        /* @__PURE__ */ u3("div", { class: "muted small", children: "The apps they use (none ticked: all of them)" }),
        apps.map((a3) => /* @__PURE__ */ u3("label", { class: "check", children: [
          /* @__PURE__ */ u3("input", { type: "checkbox", value: a3.id, checked: picked.has(a3.id), onChange: (e3) => toggle(a3.id, e3.currentTarget.checked) }),
          " ",
          a3.name
        ] }, a3.id))
      ] }),
      /* @__PURE__ */ u3("button", { class: "small primary", id: "addPerson", disabled: busy, onClick: add, children: "Add them" })
    ] });
  }
  function People({ people, pocket, apps, log, on }) {
    const here = people.filter(active);
    const head = /* @__PURE__ */ u3("div", { class: "row", children: [
      /* @__PURE__ */ u3("h2", { children: "People" }),
      /* @__PURE__ */ u3("span", { class: "muted", children: here.length ? `${here.length} in the household` : "just you so far" })
    ] });
    const why = /* @__PURE__ */ u3("p", { class: "muted", children: "Each person gets one sign-in for the apps (with a passkey, no password to remember) and a welcome page with their apps and the phone apps to install." });
    if (!pocket) {
      return /* @__PURE__ */ u3(S, { children: [
        head,
        why,
        /* @__PURE__ */ u3("div", { class: "row", children: [
          /* @__PURE__ */ u3("span", { class: "muted", children: "Adding people uses Pocket ID, the household’s sign-in." }),
          /* @__PURE__ */ u3("button", { class: "small", id: "installPocket", onClick: on.installPocket, children: "Install Pocket ID" })
        ] })
      ] });
    }
    return /* @__PURE__ */ u3(S, { children: [
      head,
      why,
      !!here.length && /* @__PURE__ */ u3("ul", { class: "alertlist", children: here.map((p3) => /* @__PURE__ */ u3(Person, { p: p3, on }, p3.username)) }),
      /* @__PURE__ */ u3(AddPerson, { apps, open: !here.length, on }),
      /* @__PURE__ */ u3("pre", { id: "peopleLog", hidden: !log, children: log })
    ] });
  }
  var mountPeople = (el, props) => R(/* @__PURE__ */ u3(People, { ...props }), el);

  // web/src/settings/Phones.tsx
  function Pairing({ p: p3, done }) {
    const links = p3.links || [];
    return /* @__PURE__ */ u3("div", { id: "pairing", children: /* @__PURE__ */ u3("div", { class: "pairing", children: [
      p3.qr && /* @__PURE__ */ u3("img", { src: p3.qr, alt: "QR code for pairing", width: 180, height: 180 }),
      /* @__PURE__ */ u3("div", { children: [
        /* @__PURE__ */ u3("p", { children: [
          "Scan this with the phone’s camera, or open a link on the phone, then tap ",
          /* @__PURE__ */ u3("strong", { children: "Pair" }),
          ". The code is ",
          /* @__PURE__ */ u3("code", { children: p3.code }),
          " and works once, for 10 minutes."
        ] }),
        /* @__PURE__ */ u3("ul", { children: links.map((l3) => /* @__PURE__ */ u3("li", { children: /* @__PURE__ */ u3("code", { children: l3 }) }, l3)) }),
        p3.off && /* @__PURE__ */ u3("p", { class: "bad", children: "The phone companion is off (PHONE_COMPANION=false): turn it on below and save first." }),
        /* @__PURE__ */ u3("p", { class: "muted", children: "Then, in Safari: Share › Add to Home Screen." }),
        links.some((l3) => l3.startsWith("http:")) && /* @__PURE__ */ u3("p", { class: "muted", children: [
          "A phone paired with the ",
          /* @__PURE__ */ u3("code", { children: "http:" }),
          " link (the home Wi-Fi, without encryption) can only look, so that nobody else on the Wi-Fi can copy its key and make changes. To make changes from a phone, pair it with an ",
          /* @__PURE__ */ u3("code", { children: "https:" }),
          " link."
        ] }),
        !!links.length && /* @__PURE__ */ u3("p", { class: "muted", children: [
          "A TV or a wall screen pairs the same way, with ",
          /* @__PURE__ */ u3("code", { children: "&kiosk" }),
          " at the end of the link (",
          /* @__PURE__ */ u3("code", { children: links[0] + "&kiosk" }),
          "): it then shows Status only, large, without buttons, and stays on. A screen can never make changes, even with ",
          /* @__PURE__ */ u3("strong", { children: "Can make changes" }),
          " ticked."
        ] }),
        /* @__PURE__ */ u3("button", { class: "small", onClick: done, children: "Done" })
      ] })
    ] }) });
  }
  function Phones({ phones, on }) {
    const [name, setName] = d2("");
    const [canChange, setCanChange] = d2(false);
    const [pairing, setPairing] = d2(null);
    const pair = async () => {
      try {
        setPairing(await on.pair(name, canChange));
      } catch {
      }
    };
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("div", { class: "row", children: [
        /* @__PURE__ */ u3("h2", { children: "Phones" }),
        /* @__PURE__ */ u3("span", { class: "muted", children: phones.length ? `${phones.length} paired` : "none paired yet" })
      ] }),
      /* @__PURE__ */ u3("p", { class: "muted", children: "Status and Backups on your phones, at home and on the tailnet (never on the internet). Each phone pairs once with a code; it can only look unless you let it make changes." }),
      !!phones.length && /* @__PURE__ */ u3("ul", { class: "alertlist", children: phones.map((p3) => /* @__PURE__ */ u3("li", { children: [
        /* @__PURE__ */ u3("span", { class: "dot " + (p3.canChange ? "warn" : "ok") }),
        /* @__PURE__ */ u3("div", { class: "grow", children: [
          /* @__PURE__ */ u3("strong", { children: p3.name }),
          /* @__PURE__ */ u3("div", { class: "muted", children: [
            p3.canChange ? "Can make changes" : p3.unencrypted ? "Looks only (paired over the home Wi-Fi, without encryption)" : "Looks only",
            " · last seen ",
            ago(p3.lastSeen)
          ] })
        ] }),
        !p3.unencrypted && /* @__PURE__ */ u3("button", { class: "small", title: p3.canChange ? "Only look from now on" : "Let it start, stop, restart, update, and back up", onClick: () => on.setCanChange(p3.id, !p3.canChange), children: p3.canChange ? "Make read-only" : "Allow changes" }),
        /* @__PURE__ */ u3("button", { class: "small", title: "Unpair it: it stops working at once", onClick: () => on.remove(p3.id), children: "Remove" })
      ] }, p3.id)) }),
      /* @__PURE__ */ u3("div", { class: "inputrow pairrow", children: [
        /* @__PURE__ */ u3("input", { id: "phoneName", placeholder: "Name, e.g. Anna’s iPhone", autocomplete: "off", spellcheck: false, value: name, onInput: (e3) => setName(e3.currentTarget.value) }),
        /* @__PURE__ */ u3("label", { class: "check", children: [
          /* @__PURE__ */ u3("input", { type: "checkbox", id: "phoneCanChange", checked: canChange, onChange: (e3) => setCanChange(e3.currentTarget.checked) }),
          " Can make changes"
        ] }),
        /* @__PURE__ */ u3("button", { class: "small", id: "pairPhone", onClick: pair, children: "Pair a phone" })
      ] }),
      pairing ? /* @__PURE__ */ u3(Pairing, { p: pairing, done: () => {
        setPairing(null);
        on.reload();
      } }) : /* @__PURE__ */ u3("div", { id: "pairing", hidden: true })
    ] });
  }
  var mountPhones = (el, props) => R(/* @__PURE__ */ u3(Phones, { ...props }), el);

  // web/src/ActionLink.tsx
  function ActionLink({ onClick, title, id, cls, children }) {
    const key = (e3) => {
      if (e3.key === "Enter" || e3.key === " ") {
        e3.preventDefault();
        onClick();
      }
    };
    return /* @__PURE__ */ u3("a", { id, class: cls, tabIndex: 0, role: "button", title, onClick, onKeyDown: key, children });
  }

  // web/src/setup/Host.tsx
  function Row2({ k: k3, children }) {
    return /* @__PURE__ */ u3("div", { children: [
      /* @__PURE__ */ u3("dt", { children: k3 }),
      /* @__PURE__ */ u3("dd", { children })
    ] });
  }
  function Background({ on }) {
    const [jobs, setJobs] = d2(null);
    const toggle = async () => {
      if (jobs) {
        setJobs(null);
        return;
      }
      try {
        setJobs(await on.background());
      } catch {
      }
    };
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("span", { children: "the scheduled jobs " }),
      /* @__PURE__ */ u3(ActionLink, { id: "bgToggle", cls: "small", onClick: toggle, children: jobs ? "Hide" : "What are these?" }),
      /* @__PURE__ */ u3("div", { id: "bgList", class: "bglist", hidden: !jobs, children: jobs && /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("ul", { class: "alertlist", children: jobs.map((j3) => /* @__PURE__ */ u3("li", { children: [
          /* @__PURE__ */ u3("span", { class: "dot " + (j3.installed ? "ok" : "") }),
          /* @__PURE__ */ u3("div", { class: "grow", children: [
            /* @__PURE__ */ u3("strong", { children: j3.name }),
            /* @__PURE__ */ u3("div", { class: "muted", children: j3.what })
          ] }),
          /* @__PURE__ */ u3("span", { class: "when muted", title: j3.label, children: j3.installed ? j3.when : "not installed" })
        ] }, j3.label)) }),
        /* @__PURE__ */ u3("p", { class: "muted small", children: [
          on.whereBackground(),
          " They only work on the homelab, and only use power while they run. Uninstalling (homelab uninstall) removes every one."
        ] }),
        jobs.some((j3) => j3.installed && j3.label !== "tray") && /* @__PURE__ */ u3("button", { id: "bgOff", class: "small", title: "The apps keep running, but nothing starts them after a restart, backs them up at night, or watches them. Setup offers to put the jobs back.", onClick: on.jobsOff, children: "Turn the scheduled jobs off" })
      ] }) })
    ] });
  }
  function Flip({ id, on, yes, no, turnOn, turnOff, set }) {
    const [busy, setBusy] = d2(false);
    return /* @__PURE__ */ u3(S, { children: [
      on ? /* @__PURE__ */ u3("span", { class: "ok", children: yes }) : /* @__PURE__ */ u3("span", { class: "muted", children: no }),
      " ",
      /* @__PURE__ */ u3("button", { class: "small", id, disabled: busy, onClick: async () => {
        setBusy(true);
        await set(!on);
        setBusy(false);
      }, children: on ? turnOff : turnOn })
    ] });
  }
  function DiskBar({ d: d3 }) {
    const used = d3.total ? Math.min(100, Math.max(1, Math.round(100 * (1 - d3.free / d3.total)))) : 0;
    return /* @__PURE__ */ u3("div", { class: "disk" + (d3.low ? " low" : ""), title: d3.hint || "", children: [
      /* @__PURE__ */ u3("div", { class: "dhead", children: [
        /* @__PURE__ */ u3("strong", { children: d3.name || "Internal disk" }),
        /* @__PURE__ */ u3("span", { class: d3.low ? "bad" : "muted", children: d3.space.replace(/\s*\(\d+%\)$/, "") })
      ] }),
      !!d3.total && /* @__PURE__ */ u3("div", { class: "storagebar", role: "meter", "aria-valuenow": used, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": `${used}% used`, children: /* @__PURE__ */ u3("span", { style: `width:${used}%` }) }),
      /* @__PURE__ */ u3("div", { class: "muted small", children: d3.label }),
      d3.low && /* @__PURE__ */ u3("div", { class: "muted small", children: d3.hint })
    ] });
  }
  function GoBack({ p: p3, go: go2 }) {
    const [sure, setSure] = d2(false);
    const click = () => {
      if (!sure) {
        setSure(true);
        return;
      }
      setSure(false);
      go2();
    };
    return /* @__PURE__ */ u3(ActionLink, { id: "upgradeBack", title: `The homelab files as they were before the update of ${new Date(p3.when).toLocaleString()}; settings and data stay`, onClick: click, children: sure ? `click again to go back to ${p3.version}` : `go back to ${p3.version} (${p3.commit.slice(0, 7)})` });
  }
  function UpgradeState({ u: u4, on }) {
    if (!u4) return /* @__PURE__ */ u3("span", { id: "upgradeState" });
    if (u4.error) return /* @__PURE__ */ u3("span", { id: "upgradeState", children: /* @__PURE__ */ u3("span", { class: "muted", title: u4.error, children: " · no update check" }) });
    return /* @__PURE__ */ u3("span", { id: "upgradeState", children: [
      u4.behind ? /* @__PURE__ */ u3("span", { class: "warn", children: ` · ${u4.behind} new change${u4.behind === 1 ? "" : "s"}` }) : /* @__PURE__ */ u3("span", { class: "ok", children: " · ✓ up to date" }),
      u4.appCommit && /* @__PURE__ */ u3("span", { class: "muted", title: "The commit this app was built from", children: ` · build ${u4.appCommit.slice(0, 7)}` }),
      u4.previous && /* @__PURE__ */ u3(S, { children: [
        " · ",
        /* @__PURE__ */ u3(GoBack, { p: u4.previous, go: on.goBack })
      ] })
    ] });
  }
  function Host({ i: i3, atLogin, menu, upgrade, on }) {
    const disks = i3.disks || [];
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(Row2, { k: "Machine", children: [
        i3.supported ? i3.osVersion || i3.os : `${i3.osVersion || i3.os} (not supported)`,
        (i3.model || i3.machine) && /* @__PURE__ */ u3("span", { class: "muted", children: " · " + (i3.model || i3.machine) })
      ] }),
      /* @__PURE__ */ u3(Row2, { k: "Container runtime", children: i3.runtimeOK ? /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("span", { class: "dot ok" }),
        i3.runtimeFound
      ] }) : /* @__PURE__ */ u3("span", { class: "bad", children: `${i3.runtime} is not ready: ${i3.runtimeHint}` }) }),
      /* @__PURE__ */ u3(Row2, { k: "Runs in the background", children: /* @__PURE__ */ u3(Background, { on }) }),
      atLogin !== null && /* @__PURE__ */ u3(Row2, { k: i3.os.startsWith("macOS") ? "Menu bar item" : "Tray icon", children: /* @__PURE__ */ u3(Flip, { id: "trayAtLogin", on: atLogin, yes: "✓ starts at login", no: "only while the app is open", turnOn: "Start at login", turnOff: "Turn off", set: on.setTrayAtLogin }) }),
      menu?.available && /* @__PURE__ */ u3(Row2, { k: "App menu", children: /* @__PURE__ */ u3(Flip, { id: "menuEntry", on: menu.added, yes: "✓ in the app menu", no: "opened from its file", turnOn: "Add to the app menu", turnOff: "Remove", set: on.setMenuEntry }) }),
      /* @__PURE__ */ u3(Row2, { k: "Homelab folder", children: [
        i3.rootOK ? i3.root : /* @__PURE__ */ u3("span", { class: "bad", children: i3.kit ? "not set up yet" : "not found" }),
        " ",
        /* @__PURE__ */ u3(ActionLink, { cls: "small", title: "Choose the folder with compose.yaml", onClick: on.chooseRoot, children: i3.rootOK ? "Change…" : "Choose…" })
      ] }),
      !!disks.length && /* @__PURE__ */ u3("div", { class: "diskrow", children: [
        /* @__PURE__ */ u3("dt", { children: "Storage" }),
        /* @__PURE__ */ u3("dd", { children: /* @__PURE__ */ u3("div", { id: "diskSpace", class: "disks", children: disks.map((d3) => /* @__PURE__ */ u3(DiskBar, { d: d3 }, d3.label + d3.name)) }) })
      ] }),
      /* @__PURE__ */ u3("div", { children: [
        /* @__PURE__ */ u3("dt", { children: "Version" }),
        /* @__PURE__ */ u3("dd", { id: "versionInfo", children: [
          i3.version,
          /* @__PURE__ */ u3(UpgradeState, { u: upgrade, on })
        ] })
      ] })
    ] });
  }
  function Runtime({ i: i3, start, open }) {
    const service = (i3.os || "").startsWith("Linux");
    const moves = "This screen moves on by itself once it is running.";
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("h2", { children: i3.runtimeInstalled ? `Start ${i3.runtime}` : `Install ${i3.runtime}` }),
      i3.runtimeInstalled ? /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("p", { children: service ? `${i3.runtime} is installed but not running. Start it now and at every boot; your password is asked for once.` : `${i3.runtime} is installed but not running. Open it, accept what it asks the first time, and turn on starting at login in its settings.` }),
        /* @__PURE__ */ u3("div", { class: "actions", children: [
          /* @__PURE__ */ u3("button", { id: "startRuntime", class: "primary", onClick: start, children: `${service ? "Start" : "Open"} ${i3.runtime}` }),
          /* @__PURE__ */ u3("span", { class: "muted", children: moves })
        ] })
      ] }) : service ? /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("ol", { children: [
          /* @__PURE__ */ u3("li", { children: `Install ${i3.runtime} and its compose plugin from your system's packages (the guide has the commands).` }),
          /* @__PURE__ */ u3("li", { children: "Add yourself to the docker group, then log out and back in." })
        ] }),
        /* @__PURE__ */ u3("div", { class: "actions", children: [
          i3.runtimeDownload && /* @__PURE__ */ u3("button", { id: "getRuntime", class: "primary", onClick: () => open(i3.runtimeDownload), children: "Open the install guide" }),
          /* @__PURE__ */ u3("span", { class: "muted", children: moves })
        ] })
      ] }) : /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("ol", { children: [
          /* @__PURE__ */ u3("li", { children: `Download ${i3.runtime}, the engine every app runs in.` }),
          /* @__PURE__ */ u3("li", { children: "Open the downloaded file and drag it to Applications (or run the installer)." }),
          /* @__PURE__ */ u3("li", { children: "Open it once and accept what it asks." })
        ] }),
        /* @__PURE__ */ u3("div", { class: "actions", children: [
          i3.runtimeDownload && /* @__PURE__ */ u3("button", { id: "getRuntime", class: "primary", onClick: () => open(i3.runtimeDownload), children: `Download ${i3.runtime}` }),
          /* @__PURE__ */ u3("span", { class: "muted", children: `Or in Terminal: ${i3.runtimeHint}. ${moves}` })
        ] })
      ] })
    ] });
  }
  function NewHomelab({ i: i3, create, choose }) {
    const [busy, setBusy] = d2(false);
    const go2 = async () => {
      setBusy(true);
      try {
        await create();
      } catch {
        setBusy(false);
      }
    };
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("h2", { children: "Start your homelab" }),
      /* @__PURE__ */ u3("p", { children: `Homelab Wizard makes the folder everything lives in, at ${i3.newRoot}, with the apps' settings and guides. Your photos, media, and backups can live elsewhere; Settings says where.` }),
      /* @__PURE__ */ u3("div", { class: "actions", children: [
        /* @__PURE__ */ u3("button", { id: "createHomelab", class: "primary", disabled: busy, onClick: go2, children: busy ? "Setting it up…" : "Set it up for me" }),
        /* @__PURE__ */ u3("span", { class: "muted", children: [
          "Already have one? ",
          /* @__PURE__ */ u3(ActionLink, { onClick: choose, children: "Choose it" })
        ] })
      ] })
    ] });
  }
  var mountHost = (el, props) => R(/* @__PURE__ */ u3(Host, { ...props }), el);
  var mountRuntime = (el, props) => R(/* @__PURE__ */ u3(Runtime, { ...props }), el);
  var mountNewHomelab = (el, props) => R(/* @__PURE__ */ u3(NewHomelab, { ...props }), el);

  // web/src/setup/Upgrade.tsx
  var upgradeShown = (c3) => c3.behind > 0 || !!c3.appUpdate || c3.appBehind > 0;
  function Upgrade({ c: c3, buildSteps, busy, upgrade, installApp: installApp2, open }) {
    const n2 = c3.behind, s3 = n2 === 1 ? "" : "s";
    const releases = c3.web ? c3.web + (c3.channel === "stable" ? "/releases" : "/actions/workflows/release.yml") : "";
    const app = c3.appUpdate;
    if (!n2 && app) {
      return /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("div", { class: "row", children: [
          /* @__PURE__ */ u3("h2", { children: app.version ? `Homelab Wizard ${app.version} is ready` : "A newer Homelab Wizard is ready" }),
          app.canInstall ? /* @__PURE__ */ u3("button", { id: "appUpdateBtn", class: "primary small", disabled: busy, onClick: installApp2, children: "Update now" }) : /* @__PURE__ */ u3("button", { class: "primary small", onClick: () => open(app.page), children: "Download it" })
        ] }),
        /* @__PURE__ */ u3("p", { class: "muted", children: app.canInstall ? "Update now downloads it, puts it in place of this one, and opens it again. Your homelab keeps running." : `Download it from the release page: ${buildSteps}.` })
      ] });
    }
    if (!n2 && c3.appBehind > 0) {
      return /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("div", { class: "row", children: [
          /* @__PURE__ */ u3("h2", { children: "A newer Homelab Wizard is ready" }),
          releases && /* @__PURE__ */ u3("button", { class: "primary small", onClick: () => open(releases), children: "Open the release builds" })
        ] }),
        /* @__PURE__ */ u3("p", { children: `The homelab folder has ${c3.appBehind} change${c3.appBehind === 1 ? "" : "s"} to the app since this build. Download the newest: ${buildSteps} (Upgrading.md).` })
      ] });
    }
    if (!n2) return null;
    const notes = [];
    if (c3.newVersion && c3.newVersion !== c3.version) notes.push(`Version ${c3.version} → ${c3.newVersion}.`);
    if (c3.settingsChanged) notes.push("New settings are added to .env on the way.");
    if (app?.canInstall) notes.push("The app updates too, and opens again.");
    else if (c3.selfUpdates && (c3.appChanged || app)) notes.push("The app updates too, once its new build is out: the banner offers it.");
    else if (c3.appChanged || app) notes.push(`The desktop app changed too: afterwards, ${buildSteps}.`);
    if (c3.dirty?.length) notes.push(`Edited here, and kept: ${c3.dirty.join(", ")}.`);
    if (c3.ahead) notes.push(`This folder has ${c3.ahead} commit(s) of its own, so it cannot simply move forward.`);
    if (c3.fetchError) notes.push("GitHub could not be reached just now; this is from the last check.");
    const shown2 = (c3.changes || []).slice(0, 6);
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("div", { class: "row", children: [
        /* @__PURE__ */ u3("h2", { children: `Update the homelab: ${n2} new change${s3}` }),
        /* @__PURE__ */ u3("button", { id: "upgradeBtn", class: "primary small", disabled: c3.ahead > 0 || busy, onClick: upgrade, children: "Update" })
      ] }),
      /* @__PURE__ */ u3("ul", { class: "alertlist", children: shown2.map((ch, i3) => /* @__PURE__ */ u3("li", { children: [
        /* @__PURE__ */ u3("span", { class: "dot" }),
        /* @__PURE__ */ u3("div", { class: "grow", children: ch.subject }),
        /* @__PURE__ */ u3("span", { class: "when muted", children: ago(ch.when) })
      ] }, i3)) }),
      n2 > shown2.length && /* @__PURE__ */ u3("p", { class: "muted", children: `and ${n2 - shown2.length} more` }),
      !!notes.length && /* @__PURE__ */ u3("p", { children: notes.join(" ") }),
      !!c3.notes?.length && /* @__PURE__ */ u3("details", { class: "whatsnew", children: [
        /* @__PURE__ */ u3("summary", { children: `What is new (${c3.notes.length})` }),
        /* @__PURE__ */ u3("ul", { children: c3.notes.map((t3, i3) => /* @__PURE__ */ u3("li", { children: t3 }, i3)) })
      ] }),
      /* @__PURE__ */ u3("p", { class: "muted", children: `Update moves the homelab folder forward to ${c3.channel === "stable" && c3.target ? c3.target + " (the stable channel)" : c3.upstream}, never merging or overwriting your own edits, then starts the homelab again so changed apps are recreated. Upgrading.md says what each batch of changes asks of you.` })
    ] });
  }
  function Banner({ u: u4, isMac: isMac2, later, restart, setInstallOnQuit }) {
    const [open, setOpen] = d2(false);
    const [busy, setBusy] = d2(false);
    const [onQuit, setOnQuit] = d2(!!u4.installOnQuit);
    const notes = u4.notes || [];
    const go2 = async () => {
      setBusy(true);
      try {
        await restart();
      } catch {
        setBusy(false);
      }
    };
    const quit = async (on) => {
      setOnQuit(on);
      try {
        await setInstallOnQuit(on);
      } catch {
        setOnQuit(!on);
      }
    };
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("div", { class: "row", children: [
        /* @__PURE__ */ u3("strong", { class: "grow", children: u4.version ? `Homelab Wizard ${u4.version} is ready` : "A Homelab Wizard update is ready" }),
        !!notes.length && /* @__PURE__ */ u3(ActionLink, { id: "updateWhatsNew", cls: "small", onClick: () => setOpen(!open), children: open ? "Hide" : "What’s new" }),
        /* @__PURE__ */ u3("button", { id: "updateLater", class: "small", onClick: later, children: "Later" }),
        /* @__PURE__ */ u3("button", { id: "updateRestart", class: "primary small", disabled: busy, title: u4.ready ? "Already downloaded: the app closes and opens again in a few seconds" : "Downloads it (a minute or two), then the app closes and opens again", onClick: go2, children: busy ? u4.ready ? "Restarting…" : "Downloading…" : "Restart to update" })
      ] }),
      /* @__PURE__ */ u3("ul", { id: "updateNotes", hidden: !open, children: [
        notes.slice(0, 12).map((n2, i3) => /* @__PURE__ */ u3("li", { children: n2 }, i3)),
        notes.length > 12 && /* @__PURE__ */ u3("li", { class: "muted", children: `and ${notes.length - 12} more` })
      ] }),
      u4.canInstallOnQuit !== false && /* @__PURE__ */ u3("label", { children: [
        /* @__PURE__ */ u3("input", { type: "checkbox", id: "installOnQuit", checked: onQuit, onChange: (e3) => quit(e3.currentTarget.checked) }),
        "Install updates when I quit the app, without asking"
      ] }),
      /* @__PURE__ */ u3("span", { class: "muted small", children: "Your homelab keeps running while the app updates." + (u4.canInstallOnQuit === false ? isMac2 ? "" : " Installing asks for an administrator’s password." : "") + (isMac2 ? " Afterwards macOS may say Homelab Wizard added items that can run in the background: that is this update, not something new. The app is not signed with a Developer ID, so macOS sees each build as new." : "") })
    ] });
  }
  var mountUpgrade = (el, props) => R(props && /* @__PURE__ */ u3(Upgrade, { ...props }), el);
  var mountBanner = (el, props) => R(props && /* @__PURE__ */ u3(Banner, { ...props }, props.u.commit), el);

  // web/src/setup/Checklist.tsx
  function Actions({ s: s3, running, on }) {
    const open = s3.state !== "waiting" && s3.state !== "done";
    const items = [
      open && !!s3.settings?.length && /* @__PURE__ */ u3("button", { class: "small", onClick: () => on.fill(s3.settings), children: "Fill in settings" }),
      open && !!s3.run?.length && /* @__PURE__ */ u3("button", { class: "small", disabled: running, onClick: () => on.run(s3), children: s3.runLabel || "Run" }),
      ...open ? (s3.choices || []).map((c3, ci) => /* @__PURE__ */ u3("button", { class: "small choice", disabled: running, onClick: () => on.run(s3, ci), children: c3.label })) : [],
      open && s3.open && /* @__PURE__ */ u3(ActionLink, { onClick: () => on.open(s3.open), children: "Open " + s3.open.replace(/^https?:\/\//, "").replace(/\/$/, "") }),
      open && s3.id === "vaultwarden" && /* @__PURE__ */ u3("button", { class: "small", onClick: on.closeSignups, children: "Close sign-ups now" }),
      s3.manual && s3.state !== "waiting" && /* @__PURE__ */ u3("label", { class: "small", children: [
        /* @__PURE__ */ u3("input", { type: "checkbox", checked: s3.state === "done", onChange: (e3) => on.markDone(s3, e3.currentTarget.checked) }),
        " Done"
      ] })
    ].filter(Boolean);
    return items.length ? /* @__PURE__ */ u3("div", { class: "actions", children: items }) : null;
  }
  var waits = (s3) => !!s3.later && s3.state !== "done";
  function progress(steps) {
    const counted = steps.filter((s3) => !waits(s3));
    const done = counted.filter((s3) => s3.state === "done").length;
    return { done, total: counted.length, left: counted.length - done, wait: steps.length - counted.length };
  }
  function Checklist({ steps, showDone, running, on }) {
    const done = steps.filter((s3) => s3.state === "done").length;
    const some = done > 0 && done < steps.length;
    const fold = some && !showDone;
    const now = steps.filter((s3) => !waits(s3));
    const later = steps.filter(waits);
    const row = (s3, i3) => fold && s3.state === "done" ? null : (
      // A row: the step's number, what it gives you, and its buttons on the right.
      /* @__PURE__ */ u3("li", { class: s3.state, children: [
        /* @__PURE__ */ u3("span", { class: "mark", children: s3.state === "done" ? /* @__PURE__ */ u3(Icon, { name: "check" }) : String(i3 + 1) }),
        /* @__PURE__ */ u3("div", { class: "body", children: [
          /* @__PURE__ */ u3("strong", { class: "title", children: s3.title }),
          /* @__PURE__ */ u3("div", { class: "sub muted", children: s3.why }),
          s3.state !== "done" && s3.detail && /* @__PURE__ */ u3("div", { class: "sub", children: s3.detail })
        ] }),
        /* @__PURE__ */ u3(Actions, { s: s3, running: running === s3.id, on })
      ] }, s3.id)
    );
    return /* @__PURE__ */ u3(S, { children: [
      some && /* @__PURE__ */ u3("li", { class: "done folded", children: [
        /* @__PURE__ */ u3("span", { class: "mark", children: /* @__PURE__ */ u3(Icon, { name: "check" }) }),
        /* @__PURE__ */ u3("div", { class: "body", children: /* @__PURE__ */ u3("strong", { class: "title", children: [
          done,
          " done"
        ] }) }),
        /* @__PURE__ */ u3("div", { class: "actions", children: /* @__PURE__ */ u3(
          "a",
          {
            id: "toggleDone",
            class: "small",
            tabIndex: 0,
            role: "button",
            onClick: on.toggleDone,
            onKeyDown: (e3) => {
              if (e3.key === "Enter" || e3.key === " ") {
                e3.preventDefault();
                on.toggleDone();
              }
            },
            children: showDone ? "Hide" : "Show"
          }
        ) })
      ] }),
      now.map((s3, i3) => row(s3, i3)),
      !!later.length && /* @__PURE__ */ u3("li", { class: "later folded", children: [
        /* @__PURE__ */ u3("span", { class: "mark", children: /* @__PURE__ */ u3(Icon, { name: "clock" }) }),
        /* @__PURE__ */ u3("div", { class: "body", children: [
          /* @__PURE__ */ u3("strong", { class: "title", children: "Can wait a week" }),
          /* @__PURE__ */ u3("div", { class: "sub muted", children: "Get the apps going first. These count again after the first week, so they are not forgotten." })
        ] })
      ] }),
      later.map((s3, i3) => row(s3, now.length + i3))
    ] });
  }
  var mountChecklist = (el, props) => R(/* @__PURE__ */ u3(Checklist, { ...props }), el);

  // web/src/backups/Backups.tsx
  var tookText = (s3) => s3 < 120 ? `${s3} seconds` : `${Math.round(s3 / 60)} minutes`;
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
  var shortPath = (p3) => {
    const parts = p3.split("/").filter(Boolean);
    return parts.length > 2 ? "…/" + parts.slice(-2).join("/") : p3;
  };
  var order = { stale: 0, none: 1, fresh: 2 };
  var sortedCopies = (o3) => (o3.copies || []).slice().sort((a3, b2) => order[a3.state] - order[b2.state]);
  function RestoreTile({ t: t3, due }) {
    const runs = t3.history || [];
    const newest = runs[runs.length - 1];
    const timed = runs.slice().reverse().find((r3) => r3.passed && r3.seconds);
    const sub = newest && !newest.passed ? /* @__PURE__ */ u3("span", { class: "bad", children: [
      "Failed ",
      ago(newest.when),
      ": ",
      newest.summary
    ] }) : due ? /* @__PURE__ */ u3("span", { class: "warn", children: "Due: Test a restore" }) : (t3.lastSummary || "Proven in the last 30 days") + (timed ? ` · in ${tookText(timed.seconds)}` : "");
    const record2 = runs.slice(-6).reverse().map((r3) => `${new Date(r3.when).toLocaleDateString(void 0, { day: "numeric", month: "short" })}: ${r3.passed ? "passed" : "failed"}${r3.seconds ? " in " + tookText(r3.seconds) : ""}`);
    return /* @__PURE__ */ u3(
      Tile,
      {
        id: "restoreTile",
        title: record2.length ? `Restore drills on record (${runs.length}):
` + record2.join("\n") : void 0,
        label: "Restore test",
        value: never(t3.lastTest) ? "Never" : ago(t3.lastTest),
        sub
      }
    );
  }
  function BackupTiles({ o: o3, os }) {
    const copies = sortedCopies(o3);
    const fresh = copies.filter((c3) => c3.state === "fresh").length;
    const stale = copies.filter((c3) => c3.state === "stale");
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(Tile, { label: "Last backup", value: never(o3.lastRun) ? "Never" : ago(o3.lastRun), sub: never(o3.envCopied) ? "Settings file not copied yet" : `Settings file copied ${ago(o3.envCopied)}` }),
      /* @__PURE__ */ u3(
        Tile,
        {
          label: "Fresh copies",
          value: /* @__PURE__ */ u3(S, { children: [
            String(fresh),
            /* @__PURE__ */ u3("small", { children: [
              " of ",
              copies.length
            ] })
          ] }),
          sub: stale.length ? /* @__PURE__ */ u3("span", { class: "bad", children: [
            "Stale: ",
            stale.map((c3) => c3.name).join(", ")
          ] }) : `Each under ${o3.staleAfterHours} hours old`
        }
      ),
      /* @__PURE__ */ u3(
        Tile,
        {
          label: "Destination",
          value: o3.destinationOK ? "Set" : /* @__PURE__ */ u3("span", { class: "warn", children: "Not set" }),
          sub: o3.destinationOK ? /* @__PURE__ */ u3("span", { title: o3.destination, children: shortPath(o3.destination) }) : os === "linux" ? "Put a backup drive or a synced folder in Settings › BACKUP_DESTINATION" : "Put a Proton Drive folder in Settings › BACKUP_DESTINATION"
        }
      ),
      /* @__PURE__ */ u3(RestoreTile, { t: o3.restoreTest || {}, due: o3.restoreDue })
    ] });
  }
  var copyMark = { fresh: ["ok", "Fresh"], stale: ["bad", "Stale"], none: ["", "None yet"] };
  function CopyRows({ o: o3 }) {
    const copies = sortedCopies(o3);
    if (!copies.length) return /* @__PURE__ */ u3("tr", { children: /* @__PURE__ */ u3("td", { colSpan: 4, class: "muted", children: "No installed app has a database to dump yet." }) });
    return /* @__PURE__ */ u3(S, { children: copies.map((c3) => {
      const [cls, word] = copyMark[c3.state] || ["", c3.state];
      return /* @__PURE__ */ u3("tr", { children: [
        /* @__PURE__ */ u3("td", { children: [
          /* @__PURE__ */ u3("strong", { children: c3.name }),
          /* @__PURE__ */ u3("span", { class: "local", children: c3.volume ? "volume archive" : "database" })
        ] }),
        /* @__PURE__ */ u3("td", { class: "state", children: [
          /* @__PURE__ */ u3("span", { class: "dot " + cls }),
          c3.state === "none" ? word : `${word} · ${ago(c3.newest)}`
        ] }),
        /* @__PURE__ */ u3("td", { children: bytes(c3.size) }),
        /* @__PURE__ */ u3("td", { children: c3.count ? String(c3.count) : "—" })
      ] }, c3.id);
    }) });
  }
  function Vault({ o: o3 }) {
    const plain = o3.plainExports || [];
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("div", { class: "row", children: [
        /* @__PURE__ */ u3("h2", { children: "Password vault export" }),
        plain.length ? /* @__PURE__ */ u3("span", { class: "bad", children: "✗ Delete the plain export" }) : never(o3.vaultExport) ? /* @__PURE__ */ u3("span", { class: "warn", children: "Never exported" }) : o3.vaultDue ? /* @__PURE__ */ u3("span", { class: "warn", children: [
          "Due: last ",
          ago(o3.vaultExport)
        ] }) : /* @__PURE__ */ u3("span", { class: "ok", children: [
          "✓ Exported ",
          ago(o3.vaultExport)
        ] })
      ] }),
      !!plain.length && /* @__PURE__ */ u3("p", { class: "bad", children: [
        plain.join(", "),
        " in recovery-staging/secrets holds every password readable. Delete it, then export again encrypted."
      ] }),
      /* @__PURE__ */ u3("p", { children: [
        "The database backup needs the server to open. Once a month, also keep an export you can open anywhere: in the Bitwarden web vault, Tools › Export vault › .json (Encrypted) › Password protected, with that password kept outside the vault. Save it in ",
        /* @__PURE__ */ u3("code", { children: "recovery-staging/secrets" }),
        " and the nightly Secrets job takes it off-site. The backup reminds you when one is due."
      ] })
    ] });
  }
  var jobMark = { ok: ["ok", "Ran"], failed: ["bad", "Failed"], stale: ["warn", "Not run for over a week"], never: ["warn", "Never run"] };
  function Jobs({ jobs, problem, create }) {
    const title = /* @__PURE__ */ u3("h2", { children: "Off-site jobs (Duplicati)" });
    if (!jobs) {
      return /* @__PURE__ */ u3("div", { class: "row", children: [
        title,
        /* @__PURE__ */ u3("span", { class: "muted", children: /DUPLICATI_PASSWORD is empty/.test(problem || "") ? "Shown here once DUPLICATI_PASSWORD is in Settings." : problem })
      ] });
    }
    if (!jobs.length) {
      return /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("div", { class: "row", children: [
          title,
          /* @__PURE__ */ u3("button", { class: "small", onClick: create, children: "Create the backup jobs" })
        ] }),
        /* @__PURE__ */ u3("p", { class: "muted", children: "No jobs yet. This makes the jobs in docs/Automation.md, encrypted with passphrases kept in .env, and runs the small ones once. Then copy DUPLICATI_SECRETS_PASSPHRASE from Settings into Vaultwarden." })
      ] });
    }
    const bad = jobs.filter((j3) => j3.state !== "ok").length;
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("div", { class: "row", children: [
        title,
        bad ? /* @__PURE__ */ u3("span", { class: "warn", children: [
          bad,
          " need a look"
        ] }) : /* @__PURE__ */ u3("span", { class: "ok", children: [
          "✓ All ",
          jobs.length,
          " ran"
        ] })
      ] }),
      /* @__PURE__ */ u3("ul", { class: "alertlist", children: jobs.map((j3) => {
        const [cls, word] = jobMark[j3.state] || ["", j3.state];
        return /* @__PURE__ */ u3("li", { children: [
          /* @__PURE__ */ u3("span", { class: "dot " + cls }),
          /* @__PURE__ */ u3("div", { class: "grow", children: [
            /* @__PURE__ */ u3("strong", { children: j3.name }),
            j3.errorMessage ? /* @__PURE__ */ u3("div", { class: "bad", children: j3.errorMessage }) : j3.state !== "ok" ? /* @__PURE__ */ u3("div", { class: "muted", children: word }) : null
          ] }),
          j3.size && /* @__PURE__ */ u3("span", { class: "size muted", children: j3.size }),
          /* @__PURE__ */ u3("span", { class: "when muted", title: never(j3.nextRun) ? "" : "Next run " + new Date(j3.nextRun).toLocaleString(), children: [
            never(j3.lastFinished) ? "never" : ago(j3.lastFinished),
            !never(j3.nextRun) && /* @__PURE__ */ u3("span", { class: "next", children: [
              " · next ",
              untilText(j3.nextRun)
            ] })
          ] })
        ] }, j3.id);
      }) })
    ] });
  }
  var mountBackupTiles = (el, props) => R(/* @__PURE__ */ u3(BackupTiles, { ...props }), el);
  var mountCopyRows = (el, props) => R(props && /* @__PURE__ */ u3(CopyRows, { ...props }), el);
  var mountVault = (el, props) => R(/* @__PURE__ */ u3(Vault, { ...props }), el);
  var mountJobs = (el, props) => R(/* @__PURE__ */ u3(Jobs, { ...props }), el);

  // web/src/status/Cards.tsx
  function Head({ title, children }) {
    return /* @__PURE__ */ u3("div", { class: "row", children: [
      /* @__PURE__ */ u3("h2", { children: title }),
      children
    ] });
  }
  function Watchdog({ w: w3, openSetup, fix }) {
    if (never(w3.lastRun)) {
      return /* @__PURE__ */ u3(Head, { title: "Watchdog", children: /* @__PURE__ */ u3("span", { class: "muted", children: [
        "It checks every app, address, and backup every 15 minutes once the jobs are installed. ",
        /* @__PURE__ */ u3(ActionLink, { onClick: openSetup, children: "Open Setup" })
      ] }) });
    }
    const failing = w3.failing || [];
    const late = Date.now() - new Date(w3.lastRun).getTime() > 45 * 6e4;
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(Head, { title: "Watchdog", children: /* @__PURE__ */ u3("span", { children: [
        failing.length ? /* @__PURE__ */ u3("span", { class: "bad", children: [
          failing.length,
          " of ",
          w3.checks,
          " checks failing"
        ] }) : /* @__PURE__ */ u3("span", { class: "ok", children: [
          "✓ All ",
          w3.checks,
          " checks passed"
        ] }),
        /* @__PURE__ */ u3("span", { class: "muted", children: [
          w3.pending && !failing.length ? `, ${w3.pending} checked again next run` : "",
          " · ",
          ago(w3.lastRun)
        ] })
      ] }) }),
      late && /* @__PURE__ */ u3("div", { class: "muted more", children: [
        "It has not run since ",
        ago(w3.lastRun),
        ". Setup › Install the jobs schedules it every 15 minutes."
      ] }),
      !!failing.length && /* @__PURE__ */ u3("div", { class: "row more", children: [
        /* @__PURE__ */ u3("span", { class: "muted", children: "Fix it restarts what is down or unwell and reconnects what dropped; it shows the plan first." }),
        /* @__PURE__ */ u3("button", { id: "watchFix", class: "small", onClick: fix, children: "Fix it" })
      ] }),
      !!failing.length && /* @__PURE__ */ u3("ul", { class: "alertlist", children: failing.map((f4) => /* @__PURE__ */ u3("li", { children: [
        /* @__PURE__ */ u3("span", { class: "dot bad" }),
        /* @__PURE__ */ u3("div", { class: "grow", children: [
          /* @__PURE__ */ u3("strong", { children: f4.name }),
          f4.problem && /* @__PURE__ */ u3("div", { class: "muted", children: f4.problem })
        ] }),
        /* @__PURE__ */ u3("span", { class: "when muted", title: "Failing since", children: ago(f4.since) })
      ] }, f4.name)) })
    ] });
  }
  function Protection({ p: p3, fix }) {
    const recent = p3.recent || [];
    const week = p3.week === 1 ? "1 attack caught this week" : `${p3.week} caught this week`;
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(Head, { title: "Protection", children: /* @__PURE__ */ u3("span", { children: [
        p3.enforced ? /* @__PURE__ */ u3("span", { class: "ok", children: "✓ Bans enforced" }) : /* @__PURE__ */ u3("span", { class: "bad", children: "Bans not enforced" }),
        /* @__PURE__ */ u3("span", { class: "muted", children: [
          " · ",
          p3.week ? week : "nothing caught this week",
          p3.bannedNow ? ` · ${p3.bannedNow} banned now` : ""
        ] })
      ] }) }),
      !p3.enforced && /* @__PURE__ */ u3("div", { class: "row more", children: [
        /* @__PURE__ */ u3("span", { class: "muted", title: p3.bouncer, children: "The proxy is not getting CrowdSec's ban list, so new attackers are not blocked." }),
        /* @__PURE__ */ u3("button", { id: "protectFix", class: "small", title: "Reconnects the proxy to CrowdSec (both restart for a moment); shows the plan first", onClick: fix, children: "Fix" })
      ] }),
      !!recent.length && /* @__PURE__ */ u3("ul", { class: "alertlist", children: recent.slice(0, 3).map((a3, i3) => /* @__PURE__ */ u3("li", { children: [
        /* @__PURE__ */ u3("span", { class: "dot " + (a3.banned ? "bad" : "") }),
        /* @__PURE__ */ u3("div", { class: "grow", children: [
          /* @__PURE__ */ u3("strong", { children: a3.scenario }),
          /* @__PURE__ */ u3("div", { class: "muted", children: [a3.ip, a3.country, a3.network].filter(Boolean).join(" · ") })
        ] }),
        a3.banned && /* @__PURE__ */ u3("span", { class: "badge", children: "Banned" }),
        /* @__PURE__ */ u3("span", { class: "when muted", children: ago(a3.when) })
      ] }, i3)) })
    ] });
  }
  var topicName = { watchtower: "Updates", "duplicati-alerts": "Backups", "uptime-kuma": "Uptime Kuma", "tunnel-watchdog": "Watchdog" };
  function Alerts({ events, problem, openSetup }) {
    if (!events) {
      return /* @__PURE__ */ u3(Head, { title: "Recent alerts", children: /NTFY_READ_TOKEN/.test(problem || "") ? /* @__PURE__ */ u3("span", { class: "muted", children: [
        "They appear here once the alert token is set up. ",
        /* @__PURE__ */ u3(ActionLink, { onClick: openSetup, children: "Open Setup" })
      ] }) : /* @__PURE__ */ u3("span", { class: "muted", children: problem }) });
    }
    if (!events.length) return /* @__PURE__ */ u3(Head, { title: "Recent alerts", children: /* @__PURE__ */ u3("span", { class: "ok", children: "✓ None in the last 12 hours" }) });
    const shown2 = events.slice(0, 5);
    const tone = (e3) => (e3.priority || 0) >= 4 ? "bad" : (e3.tags || []).includes("white_check_mark") || /^recovered/i.test(e3.title || "") ? "ok" : "";
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(Head, { title: "Recent alerts", children: /* @__PURE__ */ u3("span", { class: "muted", children: [
        events.length,
        " in the last 12 hours"
      ] }) }),
      /* @__PURE__ */ u3("ul", { class: "alertlist", children: shown2.map((e3) => /* @__PURE__ */ u3("li", { children: [
        /* @__PURE__ */ u3("span", { class: "dot " + tone(e3) }),
        /* @__PURE__ */ u3("div", { class: "grow", children: [
          /* @__PURE__ */ u3("strong", { children: e3.title || e3.message }),
          e3.title && e3.message && /* @__PURE__ */ u3("div", { class: "muted", children: e3.message })
        ] }),
        /* @__PURE__ */ u3("span", { class: "badge", children: topicName[e3.topic] || e3.topic }),
        /* @__PURE__ */ u3("span", { class: "when muted", children: ago(e3.time) })
      ] }, e3.id)) }),
      events.length > shown2.length && /* @__PURE__ */ u3("div", { class: "muted more", children: [
        "and ",
        events.length - shown2.length,
        " more in the ntfy app"
      ] })
    ] });
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
  function Bars({ rows }) {
    const most = rows[0].bytes;
    return /* @__PURE__ */ u3("ul", { class: "alertlist usage", children: rows.map((r3) => /* @__PURE__ */ u3("li", { children: [
      /* @__PURE__ */ u3("div", { class: "grow", children: [
        /* @__PURE__ */ u3("strong", { children: r3.label }),
        /* @__PURE__ */ u3("div", { class: "bar", children: /* @__PURE__ */ u3("span", { style: `width:${Math.max(2, Math.round(r3.bytes / most * 100))}%` }) })
      ] }),
      /* @__PURE__ */ u3("span", { class: "when", children: bytesText(r3.bytes) })
    ] }, r3.label)) });
  }
  var storageShown = (rec) => (rec?.photos || []).some((p3) => p3.bytes > 0) || (rec?.apps || []).some((f4) => f4.bytes > 0);
  function Storage({ rec, nameOf }) {
    const people = (rec.photos || []).filter((p3) => p3.bytes > 0);
    const folders = (rec.apps || []).filter((f4) => f4.bytes > 0);
    const total = (rows) => rows.reduce((t3, r3) => t3 + r3.bytes, 0);
    return /* @__PURE__ */ u3(S, { children: [
      !!people.length && /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3(Head, { title: "Photos per person", children: /* @__PURE__ */ u3("span", { class: "muted", children: [
          bytesText(total(people)),
          " in Immich · ",
          ago(rec.when)
        ] }) }),
        /* @__PURE__ */ u3(Bars, { rows: people.map((p3) => ({ label: p3.name, bytes: p3.bytes })) })
      ] }),
      !!folders.length && /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3(Head, { title: "What the apps keep", children: /* @__PURE__ */ u3("span", { class: "muted", title: "Each app’s folder in data/appdata, measured by the nightly backup; photos and media on their own drive are not counted", children: [
          bytesText(total(folders)),
          " of app data · ",
          ago(rec.when)
        ] }) }),
        /* @__PURE__ */ u3(Bars, { rows: folders.slice(0, 6).map((f4) => ({ label: nameOf(f4.app), bytes: f4.bytes })) })
      ] })
    ] });
  }
  function Week({ w: w3 }) {
    const lines = w3.body.split("\n").filter(Boolean);
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(Head, { title: "This week", children: /* @__PURE__ */ u3("span", { class: w3.problems ? "warn" : "ok", children: w3.problems ? `${w3.problems} thing${w3.problems === 1 ? "" : "s"} to look at` : "✓ All well" }) }),
      /* @__PURE__ */ u3("ul", { class: "alertlist week", children: lines.map((l3, i3) => {
        const ok = l3.startsWith("✓");
        return /* @__PURE__ */ u3("li", { children: [
          /* @__PURE__ */ u3("span", { class: "dot " + (ok ? "ok" : "warn") }),
          /* @__PURE__ */ u3("div", { class: "grow", children: l3.replace(/^[✓•]\s*/, "") })
        ] }, i3);
      }) }),
      /* @__PURE__ */ u3("p", { class: "muted", children: "The same summary reaches your phone on Sundays once alerts are set up." })
    ] });
  }
  var mountWatchdog = (el, props) => R(/* @__PURE__ */ u3(Watchdog, { ...props }), el);
  var mountProtection = (el, props) => R(/* @__PURE__ */ u3(Protection, { ...props }), el);
  var mountAlerts = (el, props) => R(/* @__PURE__ */ u3(Alerts, { ...props }), el);
  var mountStorage = (el, props) => R(/* @__PURE__ */ u3(Storage, { ...props }), el);
  var mountWeek = (el, props) => R(/* @__PURE__ */ u3(Week, { ...props }), el);

  // web/src/status/AppList.tsx
  function stateOf(a3, batteryPaused2) {
    if (a3.state !== "running" && batteryPaused2.has(a3.id)) return ["warn", "Paused on battery"];
    if (a3.state === "stopped" && a3.waitingFor) return ["warn", `Waiting for the ${a3.waitingFor.replace(/^\/Volumes\//, "")} drive`];
    if (a3.state === "running") {
      if (a3.health === "unhealthy") return ["bad", "Unhealthy"];
      if (a3.health === "restarting") return ["bad", "Restarting"];
      if (a3.health === "starting") return ["warn", "Starting"];
      if (a3.notAnswering) return ["bad", `Not answering: ${a3.notAnswering}`];
      return ["ok", a3.health === "native" ? "Running (native app)" : "Running"];
    }
    const words = { stopped: ["warn", "Stopped"], missing: ["bad", "Not running"], elsewhere: ["warn", "Runs elsewhere"], "not running": ["warn", "Not running"] };
    return words[a3.state] || ["", a3.state];
  }
  function Link({ url, text, open }) {
    return /* @__PURE__ */ u3(ActionLink, { onClick: () => open(url), children: text });
  }
  function Uptime({ a: a3, week }) {
    if (a3.state !== "running" || !a3.since) return null;
    const mins = Math.max(0, Math.round((Date.now() - new Date(a3.since).getTime()) / 6e4)), hours = Math.round(mins / 60);
    const up = mins < 60 ? mins <= 1 ? "up a minute" : `up ${mins} minutes` : hours < 48 ? hours === 1 ? "up an hour" : `up ${hours} hours` : `up ${Math.round(hours / 24)} days`;
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("span", { class: "local", children: up }),
      !!a3.restarts && /* @__PURE__ */ u3("span", { class: "badge warn", title: "Docker restarted it after it stopped on its own; its log says why", children: [
        "restarted ",
        a3.restarts,
        "×"
      ] }),
      a3.held && /* @__PURE__ */ u3("span", { class: "badge", title: `Left out of nightly updates after a rollback; homelab updates release ${a3.id} puts it back`, children: "updates held" }),
      a3.settingsChanged && /* @__PURE__ */ u3("span", { class: "badge warn", title: "Its settings (.env or its compose file) changed since it started, so it still runs the old ones; Fix it recreates it with the new ones", children: "settings changed" }),
      week !== void 0 && week < 0.99 && /* @__PURE__ */ u3("span", { class: "badge warn", title: "The share of the watchdog’s checks (every 15 minutes) it passed in the last 7 days", children: [
        Math.floor(week * 1e3) / 10,
        "% up this week"
      ] })
    ] });
  }
  function IconButton({ name, title, danger, disabled, onClick }) {
    return /* @__PURE__ */ u3("button", { class: "iconbtn" + (danger ? " danger" : ""), title, "aria-label": title, disabled, onClick, children: /* @__PURE__ */ u3(Icon, { name }) });
  }
  function NativeButton({ a: a3, title, label, open }) {
    const [busy, setBusy] = d2(false);
    return /* @__PURE__ */ u3("button", { class: "small", title, disabled: busy, onClick: () => {
      setBusy(true);
      open().catch(() => setBusy(false));
    }, children: label });
  }
  function Actions2({ a: a3, entry, busy, os, on }) {
    if (entry?.kind === "native") {
      const title = os === "mac" ? `Open ${a3.name}; it then keeps running in the menu bar` : os === "windows" ? `Start ${a3.name} (Windows asks for approval)` : `Start ${a3.name}'s service (asks for your password)`;
      return entry.macApp && a3.state !== "running" ? /* @__PURE__ */ u3(NativeButton, { a: a3, title, label: os === "mac" ? "Open" : "Start", open: () => on.openNative(a3) }) : null;
    }
    if (a3.state === "elsewhere") return null;
    if (a3.state === "missing") return /* @__PURE__ */ u3("button", { class: "small", onClick: () => on.install(a3), children: "Install" });
    const btn = (action, title, danger = false) => /* @__PURE__ */ u3(IconButton, { name: action, title, danger, disabled: busy, onClick: () => on.act(a3, action) });
    const back = a3.updatedAt ? btn("rollback", `Roll back: the version it ran before its update ${ago(a3.updatedAt)}, and hold its updates`) : null;
    const logs = /* @__PURE__ */ u3(IconButton, { name: "logs", title: "Logs", disabled: busy, onClick: () => on.logs(a3) });
    if (a3.state !== "running") return /* @__PURE__ */ u3(S, { children: [
      btn("start", "Start"),
      back,
      logs
    ] });
    return /* @__PURE__ */ u3(S, { children: [
      a3.address && /* @__PURE__ */ u3(IconButton, { name: "phone", title: "Open on a phone", disabled: busy, onClick: () => on.phone(a3) }),
      !!entry?.login?.length && /* @__PURE__ */ u3(IconButton, { name: "key", title: "Sign-in details", disabled: busy, onClick: () => on.signIn(a3, entry.login) }),
      btn("restart", "Restart"),
      btn("update", "Update: dump its database, pull the newest image, and recreate it"),
      back,
      btn("stop", "Stop (data is kept)", true),
      logs
    ] });
  }
  function Row3({ a: a3, p: p3 }) {
    const [cls, words] = stateOf(a3, p3.batteryPaused);
    const entry = p3.catalog?.apps.find((c3) => c3.id === a3.id);
    return /* @__PURE__ */ u3("tr", { children: [
      /* @__PURE__ */ u3("td", { children: /* @__PURE__ */ u3("strong", { children: a3.name }) }),
      /* @__PURE__ */ u3("td", { class: "state", children: [
        /* @__PURE__ */ u3("span", { class: "dot " + cls }),
        words,
        a3.state === "elsewhere" ? /* @__PURE__ */ u3(S, { children: [
          /* @__PURE__ */ u3("span", { class: "local", children: [
            "container ",
            a3.container
          ] }),
          /* @__PURE__ */ u3("button", { class: "small", onClick: () => p3.on.adopt(a3), children: "Move in" })
        ] }) : /* @__PURE__ */ u3(Uptime, { a: a3, week: p3.weekUp[a3.id] })
      ] }),
      /* @__PURE__ */ u3("td", { title: a3.address && a3.url ? "On this machine: " + a3.url : "", children: a3.address ? /* @__PURE__ */ u3(Link, { url: "https://" + a3.address, text: a3.address, open: p3.on.open }) : a3.url ? /* @__PURE__ */ u3(Link, { url: a3.url, text: a3.url.replace(/^http:\/\//, ""), open: p3.on.open }) : /* @__PURE__ */ u3("span", { class: "muted", children: "—" }) }),
      /* @__PURE__ */ u3("td", { class: "rowActions", children: /* @__PURE__ */ u3(Actions2, { a: a3, entry, busy: p3.busy, os: p3.os, on: p3.on }) })
    ] });
  }
  function StartAll({ g: g2, p: p3 }) {
    const [at, setAt] = d2(-1);
    const stopped = g2.apps.filter((a3) => a3.state === "stopped" && !a3.waitingFor && !p3.batteryPaused.has(a3.id) && p3.catalog?.apps.find((c3) => c3.id === a3.id)?.kind !== "native");
    if (!stopped.length || p3.companion) return null;
    const go2 = (e3) => {
      e3.stopPropagation();
      setAt(0);
      p3.on.startAll(stopped, setAt).finally(() => setAt(-1));
    };
    return /* @__PURE__ */ u3("button", { class: "small startall", title: "Start " + stopped.map((a3) => a3.name).join(", "), disabled: at >= 0, onClick: go2, children: at >= 0 ? `Starting ${at + 1} of ${stopped.length}…` : stopped.length === 1 ? "Start it" : `Start the ${stopped.length} stopped` });
  }
  function GroupHead({ g: g2, open, p: p3 }) {
    const running = g2.apps.filter((a3) => a3.state === "running").length;
    const key = (e3) => {
      if (e3.key === "Enter" || e3.key === " ") {
        e3.preventDefault();
        p3.on.toggle(g2.label);
      }
    };
    return /* @__PURE__ */ u3("tr", { class: "grouphead fold" + (g2.alert ? " bad" : ""), "aria-expanded": open, tabIndex: 0, onClick: () => p3.on.toggle(g2.label), onKeyDown: key, children: /* @__PURE__ */ u3("th", { colSpan: 4, children: [
      /* @__PURE__ */ u3("span", { class: "chev", children: open ? "▾" : "▸" }),
      g2.label,
      /* @__PURE__ */ u3("span", { class: "n", children: g2.alert ? String(g2.apps.length) : running === g2.apps.length ? `${running} running ✓` : `${running} of ${g2.apps.length} running` }),
      /* @__PURE__ */ u3(StartAll, { g: g2, p: p3 }),
      !open && /* @__PURE__ */ u3("span", { class: "names", children: g2.apps.map((a3) => a3.name).join(" · ") })
    ] }) });
  }
  function AppList(p3) {
    return /* @__PURE__ */ u3(S, { children: p3.groups.flatMap((g2) => {
      const open = !!p3.open[g2.label];
      return [/* @__PURE__ */ u3(GroupHead, { g: g2, open, p: p3 }, "g:" + g2.label), ...open ? g2.apps.map((a3) => /* @__PURE__ */ u3(Row3, { a: a3, p: p3 }, a3.id)) : []];
    }) });
  }
  function mountAppList(el, props) {
    R(/* @__PURE__ */ u3(AppList, { ...props }), el);
  }
  function clearAppList(el) {
    R(null, el);
  }

  // web/src/status/ReleaseNotes.tsx
  function summary(name, p3) {
    const n2 = p3.releases.length;
    if (!p3.repo) return `${name}'s image does not say where its releases are published. Updating pulls its newest image.`;
    if (p3.placed && n2 === 0) return `${name} runs ${p3.running}, the newest release. Updating pulls that release's newest build.`;
    if (n2 === 0) return `${name}'s project has published no releases.`;
    if (!p3.placed) return p3.running ? `${name} runs ${p3.running}; the newest release is ${p3.releases[0].tag}.` : `The newest release of ${name} is ${p3.releases[0].tag}. Its image does not say which version it runs now.`;
    return `${name} runs ${p3.running}; updating brings ${n2 === 1 ? p3.releases[0].tag : `${n2} releases, up to ${p3.releases[0].tag}`}.`;
  }
  var day = (when) => {
    const d3 = new Date(when);
    return isNaN(d3.getTime()) || d3.getFullYear() < 2e3 ? "" : d3.toLocaleDateString(void 0, { day: "numeric", month: "short", year: "numeric" });
  };
  function ReleaseNotes({ name, load, onUpdate, onCancel, open }) {
    const [preview, setPreview] = d2(null);
    const [problem, setProblem] = d2("");
    h2(() => {
      let live = true;
      load().then((p3) => live && setPreview(p3), (e3) => live && setProblem(String(e3?.message || e3)));
      return () => {
        live = false;
      };
    }, []);
    const shown2 = preview?.releases.slice(0, 5) || [];
    return /* @__PURE__ */ u3("div", { class: "notes", children: [
      !preview && !problem && /* @__PURE__ */ u3("p", { class: "muted", children: "Reading what is new…" }),
      problem && /* @__PURE__ */ u3("p", { class: "muted", children: [
        "Its release notes could not be read (",
        problem,
        "). Updating still works."
      ] }),
      preview && /* @__PURE__ */ u3("p", { children: summary(name, preview) }),
      shown2.map((r3) => /* @__PURE__ */ u3("section", { class: "release", children: [
        /* @__PURE__ */ u3("div", { class: "row", children: [
          /* @__PURE__ */ u3("strong", { children: [
            r3.tag,
            r3.name ? ` — ${r3.name}` : ""
          ] }),
          /* @__PURE__ */ u3("span", { class: "muted", children: day(r3.when) })
        ] }),
        r3.notes && /* @__PURE__ */ u3("pre", { children: r3.notes }),
        /* @__PURE__ */ u3("a", { href: "#", onClick: (e3) => {
          e3.preventDefault();
          open(r3.url);
        }, children: "Full notes" })
      ] }, r3.tag)),
      preview && preview.releases.length > shown2.length && preview.page && /* @__PURE__ */ u3("p", { class: "muted", children: [
        "And ",
        preview.releases.length - shown2.length,
        " older ones: ",
        /* @__PURE__ */ u3("a", { href: "#", onClick: (e3) => {
          e3.preventDefault();
          open(preview.page);
        }, children: "all releases" }),
        "."
      ] }),
      /* @__PURE__ */ u3("div", { class: "actions", children: [
        /* @__PURE__ */ u3("button", { class: "primary small", onClick: onUpdate, children: "Update" }),
        /* @__PURE__ */ u3("button", { class: "small", onClick: onCancel, children: "Cancel" })
      ] })
    ] });
  }
  function mountReleaseNotes(el, props) {
    R(/* @__PURE__ */ u3(ReleaseNotes, { ...props }), el);
  }

  // web/src/status/Usage.tsx
  var keep = 30;
  function record(history, stats) {
    const now = new Set(stats.map((s3) => s3.name));
    for (const name of history.keys()) if (!now.has(name)) history.delete(name);
    for (const s3 of stats) {
      const h4 = history.get(s3.name) || [];
      h4.push(s3.cpu);
      if (h4.length > keep) h4.shift();
      history.set(s3.name, h4);
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
          minutes > 1 ? `live, the last ${minutes} minutes` : minutes === 1 ? "live, the last minute" : "just now"
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
  function h3(tag, attrs = {}, ...kids) {
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
    if (e3.key === "F5" && !isMac && !e3.ctrlKey && !e3.altKey && !e3.metaKey) {
      e3.preventDefault();
      if (current) show(current);
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
      catalogProblem($2("groups"), String(e3));
      return;
    }
    await loadAppStates();
    fillCategories();
    const starters = catalog.presets.filter((p3) => p3.starter);
    $2("starterBox").hidden = !starters.length;
    if (!starters.length) $2("more").open = true;
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
    $2("cCategory").replaceChildren(...catalog.categories.map((c3) => h3("option", { value: c3.id }, c3.label)));
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
  function togglePreset(p3) {
    const on = p3.apps.every((id) => selected.has(id));
    p3.apps.forEach((id) => on ? selected.delete(id) : selected.add(id));
    renderApps();
    replan();
  }
  function renderApps() {
    const picks = { selected, status: statusById, toggle: togglePreset };
    mountStarters($2("starters"), { ...picks, presets: catalog.presets.filter((p3) => p3.starter) });
    mountBundles($2("presets"), { ...picks, presets: catalog.presets.filter((p3) => !p3.starter && !p3.id.startsWith("stack:")) });
    mountGroups($2("groups"), {
      catalog,
      status: statusById,
      selected,
      query,
      tick: (id, on) => {
        if (on) selected.add(id);
        else selected.delete(id);
        renderApps();
        replan();
      },
      open: (url) => go().Open(url),
      settings: (keys) => showSettings(keys)
    });
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
    const plan = (p4) => mountPlan($2("plan"), { plan: p4, appName, reason: friendlyReason });
    if (!tokens.length) {
      plan(null);
      $2("installBtn").disabled = true;
      return;
    }
    let p3;
    try {
      p3 = await go().Plan(tokens, filled());
    } catch (e3) {
      if (seq === planSeq) {
        plan(String(e3));
        $2("installBtn").disabled = true;
      }
      return;
    }
    if (seq !== planSeq) return;
    plan(p3);
    renderInputs(p3);
    const wireable = new Set(catalog.wireable || []);
    $2("wireRow").hidden = ![...p3.start, ...selected].some((id) => wireable.has(id));
    $2("installBtn").disabled = !(p3.ready && p3.start.length);
  }
  function friendlyReason(r3) {
    return r3.replace(/set ([A-Z0-9_]+(?:(?:, | and | or )[A-Z0-9_]+)*) in \.env first/g, (_2, keys) => "fill in " + keys.split(/, | and | or /).map(settingLabel).join(" and ") + " below");
  }
  var settingHelp = null;
  async function renderInputs(p3) {
    const ids = /* @__PURE__ */ new Set([...selected, ...p3.start, ...p3.skips.map((s3) => s3.app)]);
    const keys = [...new Set(catalog.apps.filter((a3) => ids.has(a3.id)).flatMap((a3) => a3.inputs || []))];
    if (keys.length && !settingHelp) {
      try {
        settingHelp = Object.fromEntries((await go().Settings()).map((s3) => [s3.key, s3]));
      } catch {
        settingHelp = {};
      }
    }
    mountInputs($2("inputs"), { keys, meta: settingHelp || {}, values: settings, label: settingLabel, input: (k3, v3) => {
      settings[k3] = v3;
      replan();
    } });
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
      const li = rows[ev.step] || (rows[ev.step] = $2("progress").appendChild(h3("li")));
      li.className = ev.error ? "failed" : ev.done ? "done" : "";
      li.textContent = label + (ev.error ? ` failed: ${ev.error}` : ev.done ? " ✓" : " …");
    });
    try {
      const started = await go().Install([...selected], filled());
      $2("started").replaceChildren(h3("h2", {}, "Started"), started.length ? h3("ul", {}, started.map((s3) => h3("li", {}, s3.url ? h3("a", { onclick: () => go().Open(s3.url) }, s3.name) : s3.name))) : h3("p", { class: "muted" }, "Nothing new to start."));
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
    const list = h3("ul", { class: "links" });
    box.replaceChildren(h3("h2", {}, "Connected for you"), h3("p", { class: "muted" }, "Connecting… this can take a minute while new apps start."), list);
    const off = window.runtime.EventsOn("link", (l3) => {
      const [mark, cls] = linkMark[l3.state] || ["•", "muted"];
      list.append(h3("li", {}, h3("span", { class: cls }, mark + " "), l3.text, l3.detail ? h3("span", { class: "detail" }, l3.detail) : null));
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
  var batteryPaused = /* @__PURE__ */ new Set();
  var weekUp = {};
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
    $2("fixIt").hidden = !(st.missing || st.apps.some((a3) => a3.health === "unhealthy" || a3.health === "restarting" || a3.notAnswering || a3.settingsChanged));
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
      const fine = (g2) => !g2.alert && g2.apps.every((a3) => a3.state === "running");
      const isOpen = (g2) => statusOpenAll || (g2.label in statusFold ? statusFold[g2.label] : !fine(g2));
      lastStatusOpen = Object.fromEntries(groups.map((g2) => [g2.label, isOpen(g2)]));
      appList = { groups, open: lastStatusOpen, catalog, weekUp, batteryPaused, busy: appsBusy, companion: document.documentElement.classList.contains("companion"), os: osName, on: appListActions };
      mountAppList($2("statusRows"), appList);
      $2("statusAll").textContent = statusOpenAll ? "Fold them again" : "Show every app";
      const waiting = [...new Set(st.apps.filter((a3) => a3.state === "stopped" && a3.waitingFor).map((a3) => a3.waitingFor.replace(/^\/Volumes\//, "")))];
      $2("statusNote").textContent = [
        waiting.length ? `Plug in ${waiting.join(" and ")}: the apps waiting for ${waiting.length === 1 ? "it" : "them"} start within 15 minutes of ${waiting.length === 1 ? "it" : "them"} appearing.` : "",
        batteryPaused.size ? `On battery: ${batteryPaused.size} app${batteryPaused.size === 1 ? "" : "s"} paused until this computer is plugged in (Settings › Battery saver).` : "",
        st.unmatched ? `${st.unmatched} other container(s) on this machine are not catalog apps.` : ""
      ].filter(Boolean).join(" ");
    } catch (e3) {
      appList = null;
      clearAppList($2("statusRows"));
      $2("statusRows").closest("table").hidden = true;
      $2("tiles").replaceChildren();
      $2("alertsCard").hidden = true;
      $2("watchCard").hidden = true;
      $2("protectCard").hidden = true;
      protectionAt = 0;
      const msg = String(e3 && e3.message || e3);
      $2("statusNote").replaceChildren(h3(
        "div",
        { class: "card notice" },
        h3("strong", {}, /not running/.test(msg) ? "The container runtime is not running" : "Status is not available"),
        h3("div", { class: "muted" }, msg),
        h3("div", { class: "muted" }, "Every app runs inside it, so they are all paused until it starts. This page checks again every 10 seconds.")
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
    mountWatchdog(card, { w: w3, openSetup: () => {
      navigated = true;
      show("setup");
    }, fix: () => cliFlow("Fix it", "fix", "", "Fix these") });
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
    mountProtection(card, { p: p3, fix: () => cliFlow("Fix it", "fix", "", "Fix these") });
  }
  async function loadStorage() {
    const card = $2("storageCard");
    let rec;
    try {
      rec = await go().Storage();
    } catch {
      rec = null;
    }
    card.hidden = !storageShown(rec);
    if (card.hidden) return;
    mountStorage(card, { rec, nameOf: (id) => catalog?.apps.find((a3) => a3.id === id)?.name || id });
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
    card.hidden = !w3.body.split("\n").some(Boolean);
    if (!card.hidden) mountWeek(card, { w: w3 });
  }
  async function loadAlerts() {
    const card = $2("alertsCard");
    const openSetup = () => {
      navigated = true;
      show("setup");
    };
    card.hidden = false;
    try {
      mountAlerts(card, { events: await go().Alerts() || [], openSetup });
    } catch (e3) {
      mountAlerts(card, { events: null, problem: String(e3 && e3.message || e3), openSetup });
    }
  }
  var appListActions = {
    act: (a3, action) => action === "update" ? showUpdate(a3) : runAppAction(a3, action),
    logs: (a3) => showLogs(a3),
    phone: (a3) => showQR(a3),
    signIn: (a3, keys) => showSignIn(a3, keys),
    openNative: (a3) => go().OpenNativeApp(a3.id).then(() => {
      setTimeout(loadStatus, 3e3);
    }, (err) => {
      showError(err);
      throw err;
    }),
    install: (a3) => {
      selected.add(a3.id);
      navigated = true;
      show("choose");
      renderApps();
      replan();
    },
    adopt: (a3) => cliFlow(`Move ${a3.name} into the homelab`, "adopt", a3.id, "Move it"),
    open: (url) => go().Open(url),
    startAll: async (apps, progress2) => {
      for (const [i3, a3] of apps.entries()) {
        progress2(i3);
        try {
          await go().AppAction(a3.id, "start");
        } catch (err) {
          showError(err);
          break;
        }
      }
      loadStatus();
    },
    toggle: (label) => toggleStatusGroup(label)
  };
  var appList = null;
  var appsBusy = false;
  function setAppsBusy(busy) {
    appsBusy = busy;
    if (appList) mountAppList($2("statusRows"), appList = { ...appList, busy });
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
    $2("cliActions").replaceChildren(h3(
      "div",
      { class: "pairing" },
      h3("img", { src: img, alt: `QR code for ${url}`, width: 180, height: 180 }),
      h3(
        "div",
        {},
        h3("p", {}, "Point the phone’s camera at the code and tap the link. ", h3("code", {}, url)),
        h3("p", { class: "muted" }, tailnet ? "The phone needs the Tailscale app, signed in to the same tailnet; then it works at home and away." : "The phone needs to be on the home Wi-Fi (or on Tailscale away from home)."),
        phoneApp ? h3("p", { class: "muted" }, `Its phone app: ${phoneApp}.`) : "",
        h3("button", { class: "small", onclick: () => {
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
    let list = [];
    try {
      list = await go().Settings();
    } catch (e3) {
      return showError(e3);
    }
    const byKey = Object.fromEntries(list.map((s3) => [s3.key, s3]));
    const label = (k3) => /PASSWORD$/.test(k3) ? "Password" : /EMAIL$/.test(k3) ? "Email" : /USER$/.test(k3) ? "User name" : settingLabel(k3);
    panel.hidden = false;
    $2("cliTitle").textContent = `Sign in to ${a3.name}`;
    $2("cliLog").textContent = "";
    $2("cliLog").hidden = true;
    const note = h3("span", { class: "muted" });
    const rows = keys.map((k3) => {
      const s3 = byKey[k3] || {};
      const copy = s3.secret ? () => go().CopySetting(k3).then(() => {
        note.textContent = "✓ Password copied; the clipboard clears in 90 seconds.";
      }, showError) : () => {
        window.runtime.ClipboardSetText?.(s3.value || "");
        note.textContent = `✓ ${label(k3)} copied.`;
      };
      return h3(
        "div",
        { class: "signin" },
        h3("span", { class: "muted" }, label(k3)),
        h3("strong", {}, s3.secret ? s3.set ? "••••••••" : "not set" : s3.value || "not set"),
        s3.set ? h3("button", { class: "small", onclick: copy }, "Copy") : null
      );
    });
    $2("cliActions").replaceChildren(
      h3("div", { class: "signins" }, rows),
      note,
      h3("button", { class: "small", onclick: () => {
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
    setAppsBusy(true);
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
    setAppsBusy(false);
    if (typeof off === "function") off();
    cliProgress(failed ? "failed" : "done");
    $2("cliTitle").textContent = failed ? `${actionTitle[action]} ${a3.name} failed` : `${a3.name}: ${action} done`;
    actions.replaceChildren(h3("button", { class: "small", onclick: () => panel.hidden = true }, "Close"));
    loadStatus();
  }
  function showUpdate(a3) {
    const panel = $2("cliPanel"), box = h3("div");
    if (cliStop) cliStop();
    panel.hidden = false;
    $2("cliTitle").textContent = `Update ${a3.name}`;
    $2("cliLog").hidden = true;
    cliProgress(null);
    $2("cliActions").replaceChildren(box);
    mountReleaseNotes(box, {
      name: a3.name,
      load: () => go().ReleaseNotes(a3.id),
      onUpdate: () => runAppAction(a3, "update"),
      onCancel: () => {
        panel.hidden = true;
        $2("cliLog").hidden = false;
      },
      open: (url) => go().Open(url)
    });
    panel.scrollIntoView({ block: "nearest" });
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
      h3("button", { class: "small", onclick: () => showLogs(a3) }, "Refresh"),
      dozzle?.state === "running" && dozzle.url ? h3("button", { class: "small", title: "Follow every log live in Dozzle", onclick: () => go().Open(dozzle.url) }, "Open Dozzle") : null,
      h3("button", { class: "small", onclick: () => {
        panel.hidden = true;
        logApp = null;
      } }, "Close")
    ].filter(Boolean));
    const explainBox = h3("div");
    $2("logExplain").replaceChildren(explainBox);
    $2("logExplain").hidden = true;
    go().Explainer().then((model) => {
      if (!model || logApp !== a3) return;
      $2("logExplain").hidden = false;
      mountExplain(explainBox, { model, ask: () => go().ExplainLogs(a3.id) });
    }, () => {
    });
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
      h3("button", { class: "primary small", onclick: async (e3) => {
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
        actions.replaceChildren(h3("button", { class: "small", onclick: () => panel.hidden = true }, "Close"));
        loadStatus();
      } }, confirmLabel),
      h3("button", { class: "small", onclick: () => {
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
  async function loadBackups() {
    let o3;
    try {
      o3 = await go().Backups();
    } catch (e3) {
      mountCopyRows($2("backupRows"), null);
      showError(e3);
      return;
    }
    mountBackupTiles($2("backupTiles"), { o: o3, os: osName });
    mountCopyRows($2("backupRows"), { o: o3 });
    mountVault($2("vaultCard"), { o: o3 });
    const problems = (o3.copies || []).filter((c3) => c3.state === "stale").length + (o3.plainExports || []).length;
    $2("backupsCount").textContent = problems ? String(problems) : "";
    loadDuplicatiJobs();
    const dup = statusById.duplicati;
    $2("openDuplicati").hidden = !(dup?.state === "running" && dup.url);
    $2("openDuplicati").onclick = () => go().Open(dup.url);
  }
  async function loadDuplicatiJobs() {
    const card = $2("dupCard");
    const create = () => backupTask("duplicati-setup", "Creating the backup jobs…", "Backup jobs created", "Creating the jobs stopped: the log says why");
    $2("restoreTest").hidden = true;
    let jobs;
    try {
      jobs = await go().DuplicatiJobs() || [];
    } catch (e3) {
      mountJobs(card, { jobs: null, problem: String(e3 && e3.message || e3), create });
      return;
    }
    $2("restoreTest").hidden = !jobs.some((j3) => j3.name.toLowerCase() === "homelab appdata" && j3.state !== "never");
    mountJobs(card, { jobs, create });
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
  async function loadHost() {
    const i3 = await go().Host();
    hostOS = i3.os || "";
    document.documentElement.classList.toggle("backdrop", !!i3.backdrop);
    const root = document.documentElement;
    root.classList.toggle("sys-accent", !!i3.accent);
    if (i3.accent) {
      root.style.setProperty("--sys-accent-light", i3.accent.light);
      root.style.setProperty("--sys-accent-dark", i3.accent.dark);
    }
    const [atLogin, menu] = await Promise.all([go().TrayAtLogin().catch(() => null), go().MenuEntry().catch(() => null)]);
    host = { i: i3, atLogin, menu, upgrade: host?.upgrade || null, on: hostActions };
    renderHost();
    $2("foot").replaceChildren(h3("span", { class: "part" }, i3.osVersion || i3.os), " · ", h3("span", { class: "part" }, i3.version));
    if (i3.rootOK) loadUpgrade(false);
    renderNewHomelab(i3);
    renderRuntime(i3);
    return i3;
  }
  var host = null;
  var renderHost = () => {
    if (host) mountHost($2("hostInfo"), host);
  };
  var hostActions = {
    background: async () => {
      try {
        return await go().Background() || [];
      } catch (e3) {
        showError(e3);
        throw e3;
      }
    },
    whereBackground: () => whereBackgroundIs(),
    jobsOff: () => {
      show("status");
      cliFlow("Turn off the scheduled jobs", "jobs-remove", "", "Turn them off");
    },
    setTrayAtLogin: async (on) => {
      try {
        await go().SetTrayAtLogin(on);
      } catch (e3) {
        showError(e3);
      }
      await loadHost();
    },
    setMenuEntry: async (on) => {
      try {
        await go().SetMenuEntry(on);
      } catch (e3) {
        showError(e3);
      }
      await loadHost();
    },
    chooseRoot: () => chooseRoot(),
    goBack: async () => {
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
    }
  };
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
    mountRuntime(card, { i: i3, start: () => {
      go().StartRuntime().catch(showError);
    }, open: (url) => go().Open(url) });
  }
  function renderNewHomelab(i3) {
    const card = $2("newHomelab");
    card.hidden = i3.rootOK || !i3.kit;
    if (card.hidden) return;
    mountNewHomelab(card, {
      i: i3,
      create: async () => {
        try {
          await go().CreateHomelab();
          await loadHost();
          await loadCatalog();
          await loadSetup();
        } catch (e3) {
          showError(e3);
          throw e3;
        }
      },
      choose: () => chooseRoot()
    });
  }
  async function loadUpgrade(force) {
    const card = $2("upgradeCard");
    let c3;
    try {
      c3 = await go().UpgradeCheck(force);
    } catch (e3) {
      card.hidden = true;
      if (host) {
        host = { ...host, upgrade: { error: String(e3 && e3.message || e3), behind: 0 } };
        renderHost();
      }
      return;
    }
    upgradeInfo = c3;
    footUpdate(upgradeShown(c3));
    if (host) {
      host = { ...host, upgrade: { behind: c3.behind, appCommit: c3.appCommit, previous: c3.previous } };
      renderHost();
    }
    renderUpgrade();
  }
  var upgradeInfo = null;
  var upgrading = false;
  function renderUpgrade() {
    const card = $2("upgradeCard"), c3 = upgradeInfo;
    card.hidden = !c3 || !upgradeShown(c3);
    mountUpgrade(card, c3 && !card.hidden ? { c: c3, buildSteps: newestBuildSteps(), busy: upgrading, upgrade: () => runUpgrade(c3.appUpdate), installApp: () => installApp(), open: (url) => go().Open(url) } : null);
  }
  function footUpdate(on) {
    document.getElementById("footUpdate")?.remove();
    if (on) $2("foot").append(h3("a", { id: "footUpdate", class: "update", title: "Open Setup to update", onclick: () => {
      navigated = true;
      show("setup");
    } }, "● Update ready"));
  }
  setInterval(() => {
    if (host?.i.rootOK) loadUpgrade(false);
  }, 36e5);
  var updateLater = "";
  function updateBanner(u4) {
    const box = $2("updateBanner");
    if (!u4 || u4.commit === updateLater || document.documentElement.classList.contains("companion")) {
      box.hidden = true;
      mountBanner(box, null);
      return;
    }
    mountBanner(box, {
      u: u4,
      isMac,
      later: () => {
        updateLater = u4.commit;
        box.hidden = true;
      },
      restart: async () => {
        try {
          await go().InstallAppUpdate();
        } catch (e3) {
          showError(e3);
          throw e3;
        }
      },
      setInstallOnQuit: async (on) => {
        try {
          await go().SetInstallOnQuit(on);
        } catch (e3) {
          showError(e3);
          throw e3;
        }
      }
    });
    box.hidden = false;
  }
  window.runtime?.EventsOn?.("app:update", updateBanner);
  try {
    go().PendingAppUpdate().then(updateBanner).catch(() => {
    });
  } catch {
  }
  async function installApp() {
    const log = $2("setupLog");
    upgrading = true;
    renderUpgrade();
    log.hidden = false;
    log.textContent += "Downloading the newest Homelab Wizard (a minute or two)…\n";
    try {
      await go().InstallAppUpdate();
      log.textContent += "Opening the new version…\n";
    } catch (e3) {
      upgrading = false;
      renderUpgrade();
      log.textContent += "The app update stopped; the homelab is fine. Try again, or download it from the release page.\n";
      showError(e3);
    }
  }
  async function runUpgrade(app) {
    const log = $2("setupLog");
    upgrading = true;
    renderUpgrade();
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
    upgrading = false;
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
      log.append(h3(
        "div",
        { class: "actions reveal" },
        h3("button", { class: "small", onclick: () => go().RevealReport().catch(showError) }, reveal),
        h3("button", { id: "emailReport", class: "small", onclick: () => go().EmailReport().catch(showError) }, "Email it to my helper"),
        h3("span", { class: "muted" }, "Read it through, then share the file when asking for help. Email starts a message to HELPER_EMAIL and shows the file to attach.")
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
  var runningStep = null;
  function renderSetup(steps) {
    lastSteps = steps;
    const { done, total, left, wait } = progress(steps);
    const waiting = wait ? ` · ${wait} can wait` : "";
    $2("checkTitle").textContent = (done === total ? `First-time setup · all ${total} done` : `First-time setup · ${done} of ${total} done`) + waiting;
    $2("setupMeter").style.width = total ? `${Math.round(100 * done / total)}%` : "0";
    setupBadge(left);
    const ready = runnable(steps);
    $2("runAll").hidden = runningAll || ready.length < 2;
    if (!runningAll) $2("runAll").textContent = `Do the ${ready.length} steps I can`;
    mountChecklist($2("checklist"), { steps, showDone: showDoneSteps, running: runningStep, on: checklistActions });
  }
  var checklistActions = {
    fill: (keys) => showSettings(keys),
    run: (s3, choice) => runStep(s3, choice),
    open: (url) => go().Open(url),
    closeSignups: async () => {
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
    },
    markDone: async (s3, done) => {
      try {
        renderSetup(await go().MarkSetupDone(s3.id, done));
      } catch (err) {
        showError(err);
      }
    },
    toggleDone: () => {
      showDoneSteps = !showDoneSteps;
      renderSetup(lastSteps);
    }
  };
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
  async function runStep(step, choice) {
    const log = $2("setupLog");
    log.hidden = false;
    log.textContent = "";
    runningStep = step.id;
    renderSetup(lastSteps);
    const off = window.runtime.EventsOn("setup:log", (line) => {
      log.textContent += line + "\n";
      log.scrollTop = log.scrollHeight;
    });
    try {
      const steps = await (choice === void 0 ? go().RunSetup(step.id) : go().RunSetupChoice(step.id, choice));
      runningStep = null;
      renderSetup(steps);
    } catch (e3) {
      runningStep = null;
      showError(e3);
      loadSetup();
    } finally {
      runningStep = null;
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
    } catch {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    mountPhones(card, { phones: phones || [], on: phonesActions });
  }
  var phonesActions = {
    setCanChange: async (id, can) => {
      try {
        await go().SetPhoneCanChange(id, can);
      } catch (e3) {
        showError(e3);
      }
      loadPhones();
    },
    remove: async (id) => {
      try {
        await go().RemovePhone(id);
      } catch (e3) {
        showError(e3);
      }
      loadPhones();
    },
    pair: async (name, can) => {
      try {
        return await go().PairPhone(name, can);
      } catch (e3) {
        showError(e3);
        throw e3;
      }
    },
    reload: () => loadPhones()
  };
  var peopleView = null;
  var peopleLog = "";
  function renderPeople() {
    if (peopleView) mountPeople($2("peopleCard"), { ...peopleView, log: peopleLog });
  }
  async function loadPeople() {
    const card = $2("peopleCard");
    let list, st;
    try {
      [list, st] = await Promise.all([go().People(), go().Status()]);
    } catch {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    const catOf = Object.fromEntries((catalog?.apps || []).map((x2) => [x2.id, x2]));
    const personal = st.apps.filter((a3) => a3.state === "running" && (a3.address || a3.url) && a3.id !== "homepage" && catOf[a3.id]?.kind !== "helper" && (!["network", "system", "security"].includes(catOf[a3.id]?.category) || a3.id === "vaultwarden"));
    peopleLog = "";
    peopleView = { people: list || [], pocket: st.apps.some((a3) => a3.id === "pocket-id" && a3.state === "running"), apps: personal.map((a3) => ({ id: a3.id, name: a3.name })), log: "", on: peopleActions };
    renderPeople();
  }
  var peopleActions = {
    act: async (action, who, mail = "", apps = []) => {
      peopleLog = "";
      renderPeople();
      const off = window.runtime.EventsOn("cli:log", (line) => {
        peopleLog += line + "\n";
        renderPeople();
      });
      let ok = true;
      try {
        await go().PersonAction(action, who, mail, apps);
      } catch (e3) {
        ok = false;
        showError(e3);
      }
      if (typeof off === "function") off();
      return ok;
    },
    openWelcome: (username) => {
      go().OpenWelcome(username).catch(showError);
    },
    installPocket: () => {
      selected.add("pocket-id");
      navigated = true;
      show("choose");
      renderApps();
      replan();
    },
    added: async (name) => {
      const added = (await go().People()).find((p3) => p3.name === name);
      if (added) go().OpenWelcome(added.username).catch(() => {
      });
      loadPeople();
    },
    reload: () => loadPeople()
  };
  async function loadSettings(focus = []) {
    loadPhones();
    loadPeople();
    let list;
    try {
      list = await go().Settings();
    } catch (e3) {
      form = null;
      formProblem($2("settingsForm"), String(e3));
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
    const pages = settingsPages(list);
    const wanted = /* @__PURE__ */ new Set([...everyday, ...(catalog?.apps || []).flatMap((a3) => a3.inputs || []), ...Object.keys(checks), ...focus]);
    everydayCount = list.filter((s3) => wanted.has(s3.key)).length;
    moreCount = list.length - everydayCount;
    if (focus.length) settingsPage = pages.find((pg) => pg.items.some((s3) => s3.key === focus[0]))?.name || settingsPage;
    if (!pages.some((pg) => pg.name === settingsPage) && !extraPages.includes(settingsPage)) settingsPage = pages[0]?.name || "";
    formVersion++;
    form = { pages, wanted, focus, checks, testable, label: settingLabel, view: settingsView(), on: formActions };
    renderSettingsNav(pages);
    filterSettings();
    if (focus.length) document.getElementById("setting-" + focus[0])?.scrollIntoView({ block: "center" });
  }
  var form = null;
  var formVersion = 0;
  var settingsView = () => ({ query: $2("settingsSearch").value, page: settingsPage, showAll: settingsShowAll });
  var errorText = (e3) => String(e3 && e3.message || e3);
  var isSecret = (key) => !!form?.pages.some((pg) => pg.items.some((s3) => s3.key === key && s3.secret));
  var formActions = {
    edited: (edits) => {
      for (const k3 of Object.keys(changed)) delete changed[k3];
      Object.assign(changed, edits);
      markChanged();
    },
    // The test checks the saved value, so a value just typed is saved first.
    test: async (key, pending) => {
      let used = false;
      if (pending !== void 0) {
        if (!(isSecret(key) && pending === "")) {
          try {
            await go().SaveSettings({ [key]: pending });
          } catch (e3) {
            return { result: { tone: "bad", text: errorText(e3) }, used: false };
          }
        }
        used = true;
      }
      try {
        const r3 = await go().TestSetting(key);
        return { result: { tone: r3.ok ? "ok" : "bad", text: (r3.ok ? "✓ " : "✗ ") + r3.message }, used };
      } catch (e3) {
        return { result: { tone: "bad", text: errorText(e3) }, used };
      }
    },
    copy: async (key) => {
      try {
        await go().CopySetting(key);
        return { tone: "ok", text: "✓ Copied. Paste it into Vaultwarden; the clipboard clears in 90 seconds." };
      } catch (e3) {
        return { tone: "bad", text: errorText(e3) };
      }
    },
    choose: async (key) => {
      try {
        return await go().ChooseFolder(key) || "";
      } catch (e3) {
        showError(e3);
        return "";
      }
    }
  };
  var settingsPage = "";
  var extraPages = ["People", "Phones"];
  function settingsPages(list) {
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
    for (const s3 of list) {
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
    const item = (name) => h3("button", { class: "pagebtn", "data-page": name, onclick: () => {
      settingsPage = name;
      $2("settingsSearch").value = "";
      filterSettings();
      document.querySelector("main").scrollTo({ top: 0 });
    } }, h3("span", {}, name), h3("span", { class: "n" }));
    const general = pages.filter((p3) => p3.kind === "general");
    const apps = pages.filter((p3) => p3.kind === "app");
    const known = Object.keys(statusById || {}).length > 0;
    const mine = known ? apps.filter((p3) => installed(p3.name) || p3.name === "Other apps") : apps;
    const others = known ? apps.filter((p3) => !mine.includes(p3)) : [];
    $2("settingsNav").replaceChildren(
      h3("div", { class: "navhead" }, "General"),
      ...general.map((p3) => item(p3.name)),
      ...extraPages.map((n2) => item(n2)),
      ...mine.length ? [h3("div", { class: "navhead" }, "Apps"), ...mine.map((p3) => item(p3.name))] : [],
      ...others.length ? [h3("div", { class: "navhead" }, "Not installed"), ...others.map((p3) => item(p3.name))] : []
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
    "AUTO_HEAL",
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
    if (!form) return;
    form = { ...form, view: settingsView() };
    mountForm($2("settingsForm"), form, formVersion);
    const searching = !!form.view.query.trim();
    const sh = shown(form.pages, form.view, form.wanted, form.label, form.checks);
    for (const [id, name] of [["peopleCard", "People"], ["phonesCard", "Phones"]]) $2(id).classList.toggle("offpage", searching || settingsPage !== name);
    for (const b2 of $2("settingsNav").querySelectorAll(".pagebtn")) {
      b2.classList.toggle("active", !searching && b2.dataset.page === settingsPage);
      b2.classList.toggle("nomatch", searching && !sh.counts[b2.dataset.page]);
      b2.querySelector(".n").textContent = searching && sh.counts[b2.dataset.page] ? String(sh.counts[b2.dataset.page]) : "";
    }
    $2("settingsNone").hidden = sh.keys.size > 0 || !searching;
    $2("settingsAll").hidden = searching || !sh.pageMore;
    $2("settingsAll").textContent = settingsShowAll ? "Show the everyday settings only" : `Show all settings (${sh.pageMore} more)`;
  }
  $2("settingsSearch").oninput = filterSettings;
  function showSettings(keys) {
    show("settings");
    loadSettings(keys);
  }
  $2("saveSettings").onclick = async () => {
    const values = {};
    for (const [k3, v3] of Object.entries(changed)) {
      if (isSecret(k3) && v3 === "") continue;
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
        const a3 = h3("a", { href: URL.createObjectURL(file), download: file.name });
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
      if (document.documentElement.classList.contains("kiosk")) return show("status");
      const screen = await go().Screen();
      if (screen) return show(screen);
      const steps = await go().Setup();
      const { left } = progress(steps);
      setupBadge(left);
      if (left && !navigated) show("setup");
    } catch (e3) {
      showError(e3);
      show("setup");
    }
  });
})();
