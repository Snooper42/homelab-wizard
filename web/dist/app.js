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
    var s3, h3, p3, v3, y3, _3, g2 = t3 && t3.__k || w, m3 = l3.length;
    for (f4 = T(u4, l3, g2, f4, m3), s3 = 0; s3 < m3; s3++) null != (p3 = u4.__k[s3]) && (h3 = -1 != p3.__i && g2[p3.__i] || d, p3.__i = s3, _3 = q(n2, p3, h3, i3, r3, o3, e3, f4, c3, a3), v3 = p3.__e, p3.ref && h3.ref != p3.ref && (h3.ref && J(h3.ref, null, p3), a3.push(p3.ref, p3.__c || v3, p3)), null == y3 && null != v3 && (y3 = v3), 4 & p3.__u ? (f4 = j(p3, f4, n2), h3.__e && (h3.__e = null)) : "function" == typeof p3.type && void 0 !== _3 ? f4 = _3 : v3 && (f4 = v3.nextSibling), p3.__u &= -7);
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
    var s3, h3, p3, v3, y3, d3, _3, k3, x2, M, I2, P2, A3, H2, T3, j3, F = u4.type;
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
            p3.componentDidUpdate(y3, d3, _3);
          });
        }
        if (p3.context = P2, p3.props = x2, p3.__P = n2, p3.__e = false, A3 = l.__r, H2 = 0, M) p3.state = p3.__s, p3.__d = false, A3 && A3(u4), s3 = p3.render(p3.props, p3.state, p3.context), w.push.apply(p3.__h, p3._sb), p3._sb = [];
        else do {
          p3.__d = false, A3 && A3(u4), s3 = p3.render(p3.props, p3.state, p3.context), p3.state = p3.__s;
        } while (p3.__d && ++H2 < 25);
        p3.state = p3.__s, null != p3.getChildContext && (i3 = m(m({}, i3), p3.getChildContext())), M && !v3 && null != p3.getSnapshotBeforeUpdate && (_3 = p3.getSnapshotBeforeUpdate(y3, d3)), T3 = null != s3 && s3.type === S && null == s3.key ? E(s3.props.children) : s3, f4 = L(n2, g(T3) ? T3 : [T3], u4, t3, i3, r3, o3, e3, f4, c3, a3), p3.base = u4.__e, u4.__u &= -161, p3.__h.length && e3.push(p3), k3 && (p3.__E = p3.__ = null);
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
    var s3, h3, p3, v3, y3, w3, _3, m3 = i3.props || d, k3 = t3.props, x2 = t3.type;
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
      for (s3 in k3) y3 = k3[s3], "children" == s3 ? v3 = y3 : "dangerouslySetInnerHTML" == s3 ? h3 = y3 : "value" == s3 ? w3 = y3 : "checked" == s3 ? _3 = y3 : c3 && "function" != typeof y3 || m3[s3] === y3 || N(u4, s3, y3, m3[s3], o3);
      if (h3) c3 || p3 && (h3.__html == p3.__html || h3.__html == u4.innerHTML) || (u4.innerHTML = h3.__html), t3.__k = [];
      else if (p3 && (u4.innerHTML = ""), L("template" == t3.type ? u4.content : u4, g(v3) ? v3 : [v3], t3, i3, r3, "foreignObject" == x2 ? "http://www.w3.org/1999/xhtml" : o3, e3, f4, e3 ? e3[0] : i3.__k && $(i3, 0), c3, a3), null != e3) for (s3 = e3.length; s3--; ) b(e3[s3]);
      c3 && "textarea" != x2 || (s3 = "value", "progress" == x2 && null == w3 ? u4.removeAttribute("value") : null != w3 && (w3 !== u4[s3] || "progress" == x2 && !w3 || "option" == x2 && w3 != m3[s3]) && N(u4, s3, w3, m3[s3], o3), s3 = "checked", null != _3 && _3 != u4[s3] && N(u4, s3, _3, m3[s3], o3));
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
  function _2(n2, u4) {
    var i3 = s2(t2++, 4);
    !c2.__s && C2(i3.__H, u4) && (i3.__ = n2, i3.u = u4, r2.__h.push(i3));
  }
  function A2(n2) {
    return o2 = 5, T2(function() {
      return { current: n2 };
    }, []);
  }
  function T2(n2, r3) {
    var u4 = s2(t2++, 7);
    return C2(u4.__H, r3) && (u4.__ = n2(), u4.__H = r3, u4.__h = n2), u4.__;
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

  // web/src/ActionLink.tsx
  function ActionLink({ onClick, title, id: id2, cls, children }) {
    const key2 = (e3) => {
      if (e3.key === "Enter" || e3.key === " ") {
        e3.preventDefault();
        onClick();
      }
    };
    return /* @__PURE__ */ u3("a", { id: id2, class: cls, tabIndex: 0, role: "button", title, onClick, onKeyDown: key2, children });
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
    chevron: '<polyline points="9 18 15 12 9 6"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'
  };

  // web/src/Icon.tsx
  function Icon({ name }) {
    return /* @__PURE__ */ u3("svg", { class: "icon", viewBox: "0 0 24 24", dangerouslySetInnerHTML: { __html: icons[name] } });
  }

  // web/src/setup/Checklist.tsx
  function Actions({ s: s3, running: running3, on }) {
    const open = s3.state !== "waiting" && s3.state !== "done";
    const items = [
      open && !!s3.settings?.length && /* @__PURE__ */ u3("button", { class: "small", onClick: () => on.fill(s3.settings), children: "Fill in settings" }),
      open && !!s3.run?.length && /* @__PURE__ */ u3("button", { class: "small", disabled: running3, onClick: () => on.run(s3), children: s3.runLabel || "Run" }),
      ...open ? (s3.choices || []).map((c3, ci) => /* @__PURE__ */ u3("button", { class: "small choice", disabled: running3, onClick: () => on.run(s3, ci), children: c3.label })) : [],
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
  function Fold({ id: id2, cls, title, names, shown: shown3, toggle }) {
    return /* @__PURE__ */ u3("li", { class: "fold " + cls, children: [
      /* @__PURE__ */ u3("span", { class: "mark", children: cls === "done" ? /* @__PURE__ */ u3(Icon, { name: "check" }) : /* @__PURE__ */ u3(Icon, { name: "clock" }) }),
      /* @__PURE__ */ u3("div", { class: "body", children: [
        /* @__PURE__ */ u3("strong", { class: "title", children: title }),
        !shown3 && names && /* @__PURE__ */ u3("span", { class: "names muted", children: " · " + names })
      ] }),
      /* @__PURE__ */ u3("div", { class: "actions", children: /* @__PURE__ */ u3("button", { id: id2, class: "linkbtn small", "aria-expanded": shown3, onClick: toggle, children: shown3 ? "Hide" : "Show" }) })
    ] });
  }
  function Checklist({ steps, showDone, showLater, running: running3, on }) {
    const [opened, setOpened] = d2({});
    const toggle = (id2) => setOpened({ ...opened, [id2]: !opened[id2] });
    const now = steps.filter((s3) => !waits(s3) && s3.state !== "done");
    const later2 = steps.filter(waits);
    const done = steps.filter((s3) => s3.state === "done");
    const row = (s3, n2) => {
      const open = !!opened[s3.id];
      const more = s3.why || s3.detail;
      return (
        // A row: the step's number, what it gives you (one line until it is
        // opened), its buttons, and the chevron that opens it.
        /* @__PURE__ */ u3("li", { class: s3.state + (open ? " open" : ""), children: [
          /* @__PURE__ */ u3("span", { class: "mark", children: s3.state === "done" ? /* @__PURE__ */ u3(Icon, { name: "check" }) : String(n2) }),
          /* @__PURE__ */ u3("div", { class: "body", children: [
            /* @__PURE__ */ u3("strong", { class: "title", children: s3.title }),
            /* @__PURE__ */ u3("div", { class: "sub muted", children: s3.why }),
            open && s3.state !== "done" && s3.detail && /* @__PURE__ */ u3("div", { class: "sub detail", children: s3.detail })
          ] }),
          /* @__PURE__ */ u3(Actions, { s: s3, running: running3 === s3.id, on }),
          more && /* @__PURE__ */ u3("button", { class: "iconbtn more", "aria-expanded": open, "aria-label": (open ? "Less about: " : "More about: ") + s3.title, onClick: () => toggle(s3.id), children: /* @__PURE__ */ u3(Icon, { name: "chevron" }) })
        ] }, s3.id)
      );
    };
    if (!now.length && !later2.length) {
      return /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("li", { class: "alldone", children: [
          /* @__PURE__ */ u3("span", { class: "mark", children: /* @__PURE__ */ u3(Icon, { name: "check" }) }),
          /* @__PURE__ */ u3("div", { class: "body", children: [
            /* @__PURE__ */ u3("strong", { class: "title", children: `All ${steps.length} steps are done` }),
            /* @__PURE__ */ u3("div", { class: "sub muted", children: "If one comes undone (a token runs out, the backup drive goes away), it shows here again, and Setup comes back in the sidebar." })
          ] }),
          /* @__PURE__ */ u3("div", { class: "actions", children: /* @__PURE__ */ u3("button", { id: "toggleDone", class: "linkbtn small", "aria-expanded": showDone, onClick: on.toggleDone, children: showDone ? "Hide" : "Show" }) })
        ] }),
        showDone && done.map((s3, i3) => row(s3, i3 + 1))
      ] });
    }
    return /* @__PURE__ */ u3(S, { children: [
      !!now.length && /* @__PURE__ */ u3("li", { class: "grouphead", children: `Needs you · ${now.length}` }),
      now.map((s3, i3) => row(s3, i3 + 1)),
      !!later2.length && /* @__PURE__ */ u3(Fold, { id: "toggleLater", cls: "later", title: `Can wait · ${later2.length}`, names: later2.map((s3) => s3.title).join(", "), shown: showLater, toggle: on.toggleLater }),
      showLater && later2.map((s3, i3) => row(s3, now.length + i3 + 1)),
      !!done.length && /* @__PURE__ */ u3(Fold, { id: "toggleDone", cls: "done", title: `Done · ${done.length}`, shown: showDone, toggle: on.toggleDone }),
      showDone && done.map((s3, i3) => row(s3, i3 + 1))
    ] });
  }
  var mountChecklist = (el, props) => R(/* @__PURE__ */ u3(Checklist, { ...props }), el);

  // web/src/format.ts
  var dollars = (v3) => "$" + Math.round(v3).toLocaleString("en-US");
  var never = (t3) => !t3 || t3.startsWith("0001-");
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

  // web/src/parts/Card.tsx
  function CardHead({ title, id: id2, children }) {
    if (children === void 0) return /* @__PURE__ */ u3("h2", { id: id2, children: title });
    return /* @__PURE__ */ u3("div", { class: "row", children: [
      /* @__PURE__ */ u3("h2", { id: id2, children: title }),
      children
    ] });
  }
  function Card({ kind, id: id2, title, role, children }) {
    return /* @__PURE__ */ u3("div", { id: id2, title, role, class: "card" + (kind ? " " + kind : ""), children });
  }

  // web/src/Spark.tsx
  function Spark({ values, w: w3 = 96, h: h3 = 24, title }) {
    const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
    const points = values.map((v3, i3) => `${(i3 / Math.max(1, values.length - 1) * w3).toFixed(1)},${(h3 - 2 - (v3 - lo) / span * (h3 - 4)).toFixed(1)}`).join(" ");
    return /* @__PURE__ */ u3("svg", { class: "spark", viewBox: `0 0 ${w3} ${h3}`, role: title ? "img" : void 0, "aria-label": title, children: /* @__PURE__ */ u3("polyline", { points, fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linejoin": "round", "stroke-linecap": "round" }) });
  }

  // web/src/status/Tiles.tsx
  function Tile({ label, value, sub, tone, id: id2, title }) {
    return /* @__PURE__ */ u3(Card, { kind: "tile" + (tone ? " " + tone : ""), id: id2, title, children: [
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
  var awaitingJobs = (a3) => a3.id === "homelab-companion" && a3.state === "not running";
  var troubled = (a3) => a3.health === "unhealthy" || a3.health === "restarting" || !!a3.notAnswering || a3.state === "missing" || a3.state === "stopped";
  function Tiles({ status: st, history, onPause }) {
    const running3 = st.apps.filter((a3) => a3.state === "running");
    const counted = st.apps.filter((a3) => !awaitingJobs(a3)).length;
    const trouble = st.apps.filter(troubled);
    const u4 = st.updates;
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(
        Tile,
        {
          label: "Running",
          value: /* @__PURE__ */ u3(S, { children: [
            running3.length,
            /* @__PURE__ */ u3("small", { children: [
              " of ",
              counted
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

  // web/src/parts/Row.tsx
  function Rows({ kind, children }) {
    return /* @__PURE__ */ u3("ul", { class: "alertlist" + (kind ? " " + kind : ""), children });
  }
  function Row({ dot, title, sub, subTone, children, end, when: when2, whenTitle, whenPlain }) {
    return /* @__PURE__ */ u3("li", { children: [
      dot !== void 0 && /* @__PURE__ */ u3("span", { class: "dot " + dot }),
      /* @__PURE__ */ u3("div", { class: "grow", children: [
        title !== void 0 && /* @__PURE__ */ u3("strong", { children: title }),
        !!sub && /* @__PURE__ */ u3("div", { class: subTone || "muted", children: sub }),
        children
      ] }),
      end,
      when2 !== void 0 && /* @__PURE__ */ u3("span", { class: whenPlain ? "when" : "when muted", title: whenTitle, children: when2 })
    ] });
  }

  // web/src/status/Cards.tsx
  function Watchdog({ w: w3, openSetup, fix }) {
    if (never(w3.lastRun)) {
      return /* @__PURE__ */ u3(CardHead, { title: "Watchdog", children: /* @__PURE__ */ u3("span", { class: "muted", children: [
        "It checks every app, address, and backup every 15 minutes once the jobs are installed. ",
        /* @__PURE__ */ u3(ActionLink, { onClick: openSetup, children: "Open Setup" })
      ] }) });
    }
    const failing = w3.failing || [];
    const late = Date.now() - new Date(w3.lastRun).getTime() > 45 * 6e4;
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: "Watchdog", children: /* @__PURE__ */ u3("span", { children: [
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
      !!failing.length && /* @__PURE__ */ u3(Rows, { children: failing.map((f4) => /* @__PURE__ */ u3(Row, { dot: "bad", title: f4.name, sub: f4.problem, when: ago(f4.since), whenTitle: "Failing since" }, f4.name)) })
    ] });
  }
  function Protection({ p: p3, fix }) {
    const recent = p3.recent || [];
    const week2 = p3.week === 1 ? "1 attack caught this week" : `${p3.week} caught this week`;
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: "Protection", children: /* @__PURE__ */ u3("span", { children: [
        p3.enforced ? /* @__PURE__ */ u3("span", { class: "ok", children: "✓ Bans enforced" }) : /* @__PURE__ */ u3("span", { class: "bad", children: "Bans not enforced" }),
        /* @__PURE__ */ u3("span", { class: "muted", children: [
          " · ",
          p3.week ? week2 : "nothing caught this week",
          p3.bannedNow ? ` · ${p3.bannedNow} banned now` : ""
        ] })
      ] }) }),
      !p3.enforced && /* @__PURE__ */ u3("div", { class: "row more", children: [
        /* @__PURE__ */ u3("span", { class: "muted", title: p3.bouncer, children: "The proxy is not getting CrowdSec's ban list, so new attackers are not blocked." }),
        /* @__PURE__ */ u3("button", { id: "protectFix", class: "small", title: "Reconnects the proxy to CrowdSec (both restart for a moment); shows the plan first", onClick: fix, children: "Fix" })
      ] }),
      !!recent.length && /* @__PURE__ */ u3(Rows, { children: recent.slice(0, 3).map((a3, i3) => /* @__PURE__ */ u3(
        Row,
        {
          dot: a3.banned ? "bad" : "",
          title: a3.scenario,
          sub: [a3.ip, a3.country, a3.network].filter(Boolean).join(" · "),
          end: a3.banned && /* @__PURE__ */ u3("span", { class: "badge", children: "Banned" }),
          when: ago(a3.when)
        },
        i3
      )) })
    ] });
  }
  var topicName = { watchtower: "Updates", "duplicati-alerts": "Backups", "uptime-kuma": "Uptime Kuma", "tunnel-watchdog": "Watchdog" };
  function Alerts({ events, problem, openSetup }) {
    if (!events) {
      return /* @__PURE__ */ u3(CardHead, { title: "Recent alerts", children: /NTFY_READ_TOKEN/.test(problem || "") ? /* @__PURE__ */ u3("span", { class: "muted", children: [
        "They appear here once the alert token is set up. ",
        /* @__PURE__ */ u3(ActionLink, { onClick: openSetup, children: "Open Setup" })
      ] }) : /* @__PURE__ */ u3("span", { class: "muted", children: problem }) });
    }
    if (!events.length) return /* @__PURE__ */ u3(CardHead, { title: "Recent alerts", children: /* @__PURE__ */ u3("span", { class: "ok", children: "✓ None in the last 12 hours" }) });
    const shown3 = events.slice(0, 5);
    const tone = (e3) => (e3.priority || 0) >= 4 ? "bad" : (e3.tags || []).includes("white_check_mark") || /^recovered/i.test(e3.title || "") ? "ok" : "";
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: "Recent alerts", children: /* @__PURE__ */ u3("span", { class: "muted", children: [
        events.length,
        " in the last 12 hours"
      ] }) }),
      /* @__PURE__ */ u3(Rows, { children: shown3.map((e3) => /* @__PURE__ */ u3(
        Row,
        {
          dot: tone(e3),
          title: e3.title || e3.message,
          sub: e3.title && e3.message,
          end: /* @__PURE__ */ u3("span", { class: "badge", children: topicName[e3.topic] || e3.topic }),
          when: ago(e3.time)
        },
        e3.id
      )) }),
      events.length > shown3.length && /* @__PURE__ */ u3("div", { class: "muted more", children: [
        "and ",
        events.length - shown3.length,
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
    return /* @__PURE__ */ u3(Rows, { kind: "usage", children: rows.map((r3) => /* @__PURE__ */ u3(Row, { title: r3.label, when: bytesText(r3.bytes), whenPlain: true, children: /* @__PURE__ */ u3("div", { class: "bar", children: /* @__PURE__ */ u3("span", { style: `width:${Math.max(2, Math.round(r3.bytes / most * 100))}%` }) }) }, r3.label)) });
  }
  var storageShown = (rec) => (rec?.photos || []).some((p3) => p3.bytes > 0) || (rec?.apps || []).some((f4) => f4.bytes > 0);
  function Storage({ rec, nameOf }) {
    const people = (rec.photos || []).filter((p3) => p3.bytes > 0);
    const folders = (rec.apps || []).filter((f4) => f4.bytes > 0);
    const total = (rows) => rows.reduce((t3, r3) => t3 + r3.bytes, 0);
    return /* @__PURE__ */ u3(S, { children: [
      !!people.length && /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3(CardHead, { title: "Photos per person", children: /* @__PURE__ */ u3("span", { class: "muted", children: [
          bytesText(total(people)),
          " in Immich · ",
          ago(rec.when)
        ] }) }),
        /* @__PURE__ */ u3(Bars, { rows: people.map((p3) => ({ label: p3.name, bytes: p3.bytes })) })
      ] }),
      !!folders.length && /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3(CardHead, { title: "What the apps keep", children: /* @__PURE__ */ u3("span", { class: "muted", title: "Each app’s folder in data/appdata, measured by the nightly backup; photos and media on their own drive are not counted", children: [
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
    const toSet = lines.filter((l3) => l3.startsWith("◦")).length;
    const head = w3.problems ? /* @__PURE__ */ u3("span", { class: "warn", children: `${w3.problems} thing${w3.problems === 1 ? "" : "s"} to look at` }) : toSet ? /* @__PURE__ */ u3("span", { class: "muted", children: `Getting started: ${toSet} still to set up` }) : /* @__PURE__ */ u3("span", { class: "ok", children: "✓ All well" });
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: "This week", children: head }),
      /* @__PURE__ */ u3(Rows, { kind: "week", children: lines.map((l3, i3) => /* @__PURE__ */ u3(Row, { dot: l3.startsWith("✓") ? "ok" : l3.startsWith("•") ? "warn" : "", children: l3.replace(/^[✓•◦]\s*/, "") }, i3)) }),
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
    if (a3.state === "not running" && a3.id === "homelab-companion") return ["", "Starts with the scheduled jobs (Setup)"];
    const words = { stopped: ["warn", "Stopped"], missing: ["bad", "Not running"], elsewhere: ["warn", "Runs elsewhere"], "not running": ["warn", "Not running"] };
    return words[a3.state] || ["", a3.state];
  }
  var doing = { start: "Starting…", stop: "Stopping…", restart: "Restarting…", update: "Updating…", rollback: "Rolling back…" };
  var verb = { start: "start", stop: "stop", restart: "restart", update: "update", rollback: "roll back" };
  function Link({ url, text, open }) {
    const parts = text.split(new RegExp("(?<=[.:])"));
    return /* @__PURE__ */ u3(ActionLink, { onClick: () => open(url), children: parts.map((t3, i3) => /* @__PURE__ */ u3(S, { children: [
      i3 ? /* @__PURE__ */ u3("wbr", {}) : null,
      t3
    ] })) });
  }
  function Uptime({ a: a3, week: week2 }) {
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
      week2 !== void 0 && week2 < 0.99 && /* @__PURE__ */ u3("span", { class: "badge warn", title: "The share of the watchdog’s checks (every 15 minutes) it passed in the last 7 days", children: [
        Math.floor(week2 * 1e3) / 10,
        "% up this week"
      ] })
    ] });
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
    if (a3.state !== "running") return /* @__PURE__ */ u3("button", { class: "small rowmain change", title: `Start ${a3.name}`, disabled: busy, onClick: () => on.act(a3, "start"), children: "Start" });
    const url = a3.address ? "https://" + a3.address : a3.url;
    return url ? /* @__PURE__ */ u3("button", { class: "small rowmain", title: `Open ${a3.name}`, onClick: () => on.open(url), children: "Open" }) : null;
  }
  function Row2({ a: a3, p: p3 }) {
    const pend = p3.pending[a3.id];
    const [cls, words] = pend && !pend.failed ? ["warn", doing[pend.action] || "Working…"] : stateOf(a3, p3.batteryPaused);
    const entry = p3.catalog?.apps.find((c3) => c3.id === a3.id);
    return (
      // A click anywhere on the row (not on its links and buttons), or Return
      // on it, opens the app's page.
      /* @__PURE__ */ u3(
        "tr",
        {
          "aria-busy": pend && !pend.failed ? true : void 0,
          class: a3.state !== "missing" ? "topage" : void 0,
          onClick: a3.state !== "missing" ? (e3) => {
            if (!e3.target.closest("a, button")) p3.on.page(a3);
          } : void 0,
          children: [
            /* @__PURE__ */ u3("td", { children: /* @__PURE__ */ u3("strong", { children: a3.name }) }),
            /* @__PURE__ */ u3("td", { class: "state", children: [
              /* @__PURE__ */ u3("span", { class: "dot " + cls }),
              words,
              pend && !pend.failed ? null : a3.state === "elsewhere" ? /* @__PURE__ */ u3(S, { children: [
                /* @__PURE__ */ u3("span", { class: "local", children: [
                  "container ",
                  a3.container
                ] }),
                /* @__PURE__ */ u3("button", { class: "small", onClick: () => p3.on.adopt(a3), children: "Move in" })
              ] }) : /* @__PURE__ */ u3(Uptime, { a: a3, week: p3.weekUp[a3.id] }),
              pend?.failed && /* @__PURE__ */ u3("span", { class: "rowerr", role: "status", children: [
                "Could not ",
                verb[pend.action] || pend.action,
                ": ",
                pend.failed
              ] })
            ] }),
            /* @__PURE__ */ u3("td", { title: a3.address && a3.url ? "On this machine: " + a3.url : "", children: a3.address ? /* @__PURE__ */ u3(Link, { url: "https://" + a3.address, text: a3.address, open: p3.on.open }) : a3.url ? /* @__PURE__ */ u3(Link, { url: a3.url, text: a3.url.replace(/^http:\/\//, ""), open: p3.on.open }) : /* @__PURE__ */ u3("span", { class: "muted", children: "—" }) }),
            /* @__PURE__ */ u3("td", { class: "rowActions", children: [
              /* @__PURE__ */ u3(Actions2, { a: a3, entry, busy: p3.busy, os: p3.os, on: p3.on }),
              a3.state !== "missing" && /* @__PURE__ */ u3("button", { class: "iconbtn topage", title: `${a3.name}: its page`, "aria-label": `${a3.name}: its page`, onClick: () => p3.on.page(a3), children: /* @__PURE__ */ u3(Icon, { name: "chevron" }) })
            ] })
          ]
        }
      )
    );
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
  function GroupHead({ g: g2, open, toggle, p: p3 }) {
    const running3 = g2.apps.filter((a3) => a3.state === "running").length;
    const counted = g2.apps.filter((a3) => !awaitingJobs(a3)).length;
    return /* @__PURE__ */ u3("tr", { class: "grouphead fold" + (g2.alert ? " bad" : "") + (open ? " open" : ""), onClick: toggle, children: /* @__PURE__ */ u3("th", { colSpan: 4, children: [
      /* @__PURE__ */ u3("button", { type: "button", class: "foldbtn", "aria-expanded": open, onClick: (e3) => {
        e3.stopPropagation();
        toggle();
      }, children: [
        /* @__PURE__ */ u3("span", { class: "chev", "aria-hidden": "true", children: open ? "▾" : "▸" }),
        g2.label
      ] }),
      /* @__PURE__ */ u3("span", { class: "n", children: g2.alert ? String(g2.apps.length) : running3 >= counted ? `${running3} running ✓` : `${running3} of ${counted} running` }),
      /* @__PURE__ */ u3(StartAll, { g: g2, p: p3 }),
      !open && /* @__PURE__ */ u3("span", { class: "names", children: g2.apps.map((a3) => a3.name).join(" · ") })
    ] }) });
  }
  var foldKey = "homelab.statusOpen";
  var fold = { all: false, picked: {} };
  try {
    const v3 = localStorage.getItem(foldKey);
    if (v3 === "all") fold = { all: true, picked: {} };
    else if (v3) {
      const kept = JSON.parse(v3);
      fold = { all: false, picked: Array.isArray(kept) ? Object.fromEntries(kept.map((l3) => [l3, true])) : kept };
    }
  } catch {
  }
  var folded = [];
  function setFold(f4) {
    fold = f4;
    try {
      localStorage.setItem(foldKey, f4.all ? "all" : JSON.stringify(f4.picked));
    } catch {
    }
    folded.forEach((fn) => fn(f4));
  }
  function useFold() {
    const [f4, set2] = d2(fold);
    h2(() => {
      folded.push(set2);
      set2(fold);
      return () => {
        folded.splice(folded.indexOf(set2), 1);
      };
    }, []);
    return f4;
  }
  function openGroups(groups, f4) {
    const fine = (g2) => !g2.alert && g2.apps.every((a3) => a3.state === "running" || awaitingJobs(a3));
    return Object.fromEntries(groups.map((g2) => [g2.label, f4.all || (g2.label in f4.picked ? f4.picked[g2.label] : !fine(g2))]));
  }
  function AppList(p3) {
    const f4 = useFold();
    const open = openGroups(p3.groups, f4);
    const toggle = (label) => setFold({ all: false, picked: { ...f4.all ? open : f4.picked, [label]: !open[label] } });
    return /* @__PURE__ */ u3(S, { children: p3.groups.flatMap((g2) => [
      /* @__PURE__ */ u3(GroupHead, { g: g2, open: open[g2.label], toggle: () => toggle(g2.label), p: p3 }, "g:" + g2.label),
      ...open[g2.label] ? g2.apps.map((a3) => /* @__PURE__ */ u3(Row2, { a: a3, p: p3 }, a3.id)) : []
    ]) });
  }
  function ShowAll() {
    const f4 = useFold();
    return /* @__PURE__ */ u3("button", { id: "statusAll", class: "linkbtn", onClick: () => setFold({ all: !f4.all, picked: {} }), children: f4.all ? "Fold them again" : "Show every app" });
  }
  function mountAppList(el, props) {
    R(/* @__PURE__ */ u3(AppList, { ...props }), el);
  }
  function mountShowAll(el) {
    R(/* @__PURE__ */ u3(ShowAll, {}), el);
  }
  function clearAppList(el) {
    R(null, el);
  }

  // web/src/store.ts
  function store(read) {
    const watchers = [];
    let running3 = null;
    let again = null;
    const tell = () => watchers.forEach((fn) => fn());
    const s3 = {
      value: void 0,
      error: void 0,
      at: 0,
      load() {
        if (running3) return again ??= running3.then(() => {
          again = null;
          return s3.load();
        });
        running3 = (async () => {
          try {
            s3.value = await read();
            s3.error = void 0;
            s3.at = Date.now();
          } catch (e3) {
            s3.error = e3;
            s3.at = 0;
          }
          running3 = null;
          tell();
        })();
        return running3;
      },
      fresh(maxAge) {
        if (running3) return running3;
        return !s3.at || Date.now() - s3.at > maxAge ? s3.load() : Promise.resolve();
      },
      set(v3) {
        s3.value = v3;
        s3.error = void 0;
        s3.at = Date.now();
        tell();
      },
      stale() {
        s3.at = 0;
      },
      watch(fn) {
        watchers.push(fn);
      }
    };
    return s3;
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
  var day = (when2) => {
    const d3 = new Date(when2);
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
    const shown3 = preview?.releases.slice(0, 5) || [];
    return /* @__PURE__ */ u3("div", { class: "notes", children: [
      !preview && !problem && /* @__PURE__ */ u3("p", { class: "muted", children: "Reading what is new…" }),
      problem && /* @__PURE__ */ u3("p", { class: "muted", children: [
        "Its release notes could not be read (",
        problem,
        "). Updating still works."
      ] }),
      preview && /* @__PURE__ */ u3("p", { children: summary(name, preview) }),
      shown3.map((r3) => /* @__PURE__ */ u3("section", { class: "release", children: [
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
      preview && preview.releases.length > shown3.length && preview.page && /* @__PURE__ */ u3("p", { class: "muted", children: [
        "And ",
        preview.releases.length - shown3.length,
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

  // web/src/parts/Notes.tsx
  function StatusNote({ text, down }) {
    if (!down) return /* @__PURE__ */ u3(S, { children: text });
    return /* @__PURE__ */ u3(Card, { kind: "notice", children: [
      /* @__PURE__ */ u3("strong", { children: /not running/.test(down) ? "The container runtime is not running" : "Status is not available" }),
      /* @__PURE__ */ u3("div", { class: "muted", children: down }),
      /* @__PURE__ */ u3("div", { class: "muted", children: "Every app runs inside it, so they are all paused until it starts. This page checks again every 10 seconds." })
    ] });
  }
  function ReportActions({ reveal, show: show2, email }) {
    return /* @__PURE__ */ u3("div", { class: "actions reveal", children: [
      /* @__PURE__ */ u3("button", { class: "small", onClick: show2, children: reveal }),
      /* @__PURE__ */ u3("button", { id: "emailReport", class: "small", onClick: email, children: "Email it to my helper" }),
      /* @__PURE__ */ u3("span", { class: "muted", children: "Read it through, then share the file when asking for help. Email starts a message to HELPER_EMAIL and shows the file to attach." })
    ] });
  }
  function mountStatusNote(el, props) {
    R(/* @__PURE__ */ u3(StatusNote, { ...props }), el);
  }
  function mountReportActions(el, props) {
    R(props ? /* @__PURE__ */ u3(ReportActions, { ...props }) : null, el);
  }

  // web/src/parts/Sheet.tsx
  var openSheets = () => [...document.querySelectorAll(".panel.sheet:not([hidden])")];
  var escapes = false;
  function closeOnEscape() {
    if (escapes) return;
    escapes = true;
    document.addEventListener("keydown", (e3) => {
      if (e3.key !== "Escape") return;
      const open = openSheets().pop();
      const close2 = open && [...open.querySelectorAll("button:not([disabled])")].find((b2) => /^(Close|Cancel)$/.test(b2.textContent.trim()));
      if (close2) {
        e3.preventDefault();
        close2.click();
      }
    });
  }
  function Sheet({ id: id2, titleId, onClose, children }) {
    const ref = A2(null);
    _2(() => {
      closeOnEscape();
      const panel = ref.current;
      let before = null;
      const seen = new MutationObserver(() => {
        document.documentElement.classList.toggle("sheet-open", openSheets().length > 0);
        if (!panel.hidden) {
          if (!panel.contains(document.activeElement)) before = document.activeElement;
          requestAnimationFrame(() => (panel.querySelector("button:not([disabled])") || panel).focus());
        } else {
          if (before && document.contains(before)) before.focus();
          before = null;
          if (!openSheets().length) onClose?.();
        }
      });
      seen.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
      return () => seen.disconnect();
    }, []);
    return /* @__PURE__ */ u3("div", { ref, id: id2, class: "panel sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, tabIndex: -1, hidden: true, children });
  }

  // web/src/sheets/Sheet.tsx
  function CommandSheet({ onClose }) {
    return /* @__PURE__ */ u3(Sheet, { id: "cliPanel", titleId: "cliTitle", onClose, children: [
      /* @__PURE__ */ u3("h2", { id: "cliTitle", "aria-live": "polite" }),
      /* @__PURE__ */ u3("div", { id: "cliProgress", class: "progress", hidden: true, children: [
        /* @__PURE__ */ u3("div", { class: "track", children: /* @__PURE__ */ u3("span", { class: "fill" }) }),
        /* @__PURE__ */ u3("p", { class: "step", "aria-live": "polite" })
      ] }),
      /* @__PURE__ */ u3("div", { id: "cliApps", "aria-live": "polite" }),
      /* @__PURE__ */ u3("details", { id: "cliDetails", class: "jobdetails", open: true, children: [
        /* @__PURE__ */ u3("summary", { children: "Show details" }),
        /* @__PURE__ */ u3("pre", { id: "cliLog", role: "log" })
      ] }),
      /* @__PURE__ */ u3("div", { id: "cliActions", class: "actions" })
    ] });
  }
  function mountSheets(el, closed) {
    R(/* @__PURE__ */ u3(CommandSheet, { onClose: closed }), el);
  }
  function Buttons({ buttons }) {
    const [running3, setRunning] = d2(-1);
    return /* @__PURE__ */ u3(S, { children: buttons.map((b2, i3) => /* @__PURE__ */ u3(
      "button",
      {
        class: b2.primary ? "primary small" : "small",
        title: b2.title,
        disabled: running3 === i3,
        onClick: async () => {
          setRunning(i3);
          try {
            await b2.onClick();
          } finally {
            setRunning(-1);
          }
        },
        children: b2.label
      },
      b2.label
    )) });
  }
  function PhoneCode({ url, img, tailnet, phoneApp, close: close2 }) {
    return /* @__PURE__ */ u3("div", { class: "pairing", children: [
      /* @__PURE__ */ u3("img", { src: img, alt: `QR code for ${url}`, width: 180, height: 180 }),
      /* @__PURE__ */ u3("div", { children: [
        /* @__PURE__ */ u3("p", { children: [
          "Point the phone’s camera at the code and tap the link. ",
          /* @__PURE__ */ u3("code", { children: url })
        ] }),
        /* @__PURE__ */ u3("p", { class: "muted", children: tailnet ? "The phone needs the Tailscale app, signed in to the same tailnet; then it works at home and away." : "The phone needs to be on the home Wi-Fi (or on Tailscale away from home)." }),
        phoneApp && /* @__PURE__ */ u3("p", { class: "muted", children: [
          "Its phone app: ",
          phoneApp,
          "."
        ] }),
        /* @__PURE__ */ u3("button", { class: "small", onClick: close2, children: "Close" })
      ] })
    ] });
  }
  function SignIns({ rows, close: close2 }) {
    const [note, setNote] = d2("");
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("div", { class: "signins", children: rows.map((r3) => /* @__PURE__ */ u3("div", { class: "signin", children: [
        /* @__PURE__ */ u3("span", { class: "muted", children: r3.label }),
        /* @__PURE__ */ u3("strong", { children: r3.shown }),
        r3.copy && /* @__PURE__ */ u3("button", { class: "small", onClick: async () => {
          try {
            setNote(await r3.copy());
          } catch {
          }
        }, children: "Copy" })
      ] }, r3.label)) }),
      /* @__PURE__ */ u3("span", { class: "muted", children: note }),
      /* @__PURE__ */ u3("button", { class: "small", onClick: close2, children: "Close" })
    ] });
  }
  function mountSheet(el, node) {
    R(/* @__PURE__ */ u3(S, { children: node }), el);
  }

  // web/src/status/CrashNote.tsx
  function day2(when2, now = /* @__PURE__ */ new Date()) {
    const d3 = new Date(when2);
    const start = (x2) => new Date(x2.getFullYear(), x2.getMonth(), x2.getDate()).getTime();
    const days = Math.round((start(now) - start(d3)) / 864e5);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return "on " + d3.toLocaleDateString("en-GB", { weekday: "long" });
    return "on " + d3.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  }
  function CrashNote({ crash, send, hide }) {
    if (!crash) return null;
    const who = crash.who.charAt(0).toUpperCase() + crash.who.slice(1);
    return /* @__PURE__ */ u3(Card, { kind: "notice crashnote", role: "status", children: [
      /* @__PURE__ */ u3("strong", { children: [
        who,
        " stopped unexpectedly ",
        day2(crash.when)
      ] }),
      /* @__PURE__ */ u3("div", { class: "muted", children: [
        "The diagnostics report carries what happened (",
        crash.file,
        "), with passwords and tokens taken out, for whoever helps you."
      ] }),
      /* @__PURE__ */ u3("div", { class: "actions", children: [
        /* @__PURE__ */ u3("button", { class: "primary small", onClick: send, children: "Send the report" }),
        /* @__PURE__ */ u3("button", { class: "small", onClick: hide, children: "Hide" })
      ] })
    ] });
  }
  function mountCrashNote(el, props) {
    el.hidden = !props.crash;
    R(/* @__PURE__ */ u3(CrashNote, { ...props }), el);
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
      /* @__PURE__ */ u3(CardHead, { title: "What’s using power", children: /* @__PURE__ */ u3("span", { class: "muted", title: "Percent of one processor core; 100% is one core kept busy", children: [
        Math.round(total),
        "% of a core in all · ",
        minutes > 1 ? `live, the last ${minutes} minutes` : minutes === 1 ? "live, the last minute" : "just now"
      ] }) }),
      /* @__PURE__ */ u3(Rows, { kind: "usage", children: busy.slice(0, 6).map((s3) => {
        const past = history.get(s3.name) || [];
        return /* @__PURE__ */ u3(
          Row,
          {
            title: nameOf(s3.name),
            whenPlain: true,
            when: /* @__PURE__ */ u3(S, { children: [
              Math.round(s3.cpu),
              "%",
              s3.mem ? " · " + s3.mem : ""
            ] }),
            end: past.length >= 3 ? /* @__PURE__ */ u3(Spark, { values: past, w: 72, h: 20, title: `${nameOf(s3.name)}'s use over the last minutes` }) : null,
            children: /* @__PURE__ */ u3("div", { class: "bar", children: /* @__PURE__ */ u3("span", { style: { width: `${Math.max(2, Math.round(s3.cpu / most * 100))}%` } }) })
          },
          s3.name
        );
      }) }),
      /* @__PURE__ */ u3("p", { class: "muted", children: heavy.length ? `${heavy.map((s3) => nameOf(s3.name)).join(" and ")} ${heavy.length === 1 ? "is" : "are"} busy. Some apps work hard for a while after you add files (Immich reads new photos); if it lasts, stop what you don’t use. On battery, the battery saver pauses the heaviest apps.` : "Nothing is working hard. On battery, the battery saver pauses the heaviest apps." })
    ] });
  }
  function mountUsage(el, props) {
    el.hidden = !props.stats.some((s3) => s3.cpu >= 1);
    R(el.hidden ? null : /* @__PURE__ */ u3(Usage, { ...props }), el);
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
        const step2 = checks[s3.key];
        const text = [pg.name, label(s3.key), s3.key.replace(/_/g, " "), s3.help || "", step2 ? step2.title : "", "setting-" + s3.key].join(" ").toLowerCase();
        const match = words.length ? words.every((w3) => text.includes(w3)) : here && (view.showAll || !more);
        if (match) {
          out.keys.add(s3.key);
          out.counts[pg.name] = (out.counts[pg.name] || 0) + 1;
        }
      }
    }
    return out;
  }
  function plainHelp(help, toggle) {
    const words = help.replace(/\s*\((?:\.\/)?homelab [^)]*\)/g, "");
    if (!toggle) return words;
    return words.split(new RegExp("(?<=\\.)\\s+")).filter((t3) => !/^(true|false)\b/i.test(t3)).join(" ");
  }
  function Row3({ s: s3, p: p3, value, hidden, edit }) {
    const [result, setResult] = d2(null);
    const [testing, setTesting] = d2(false);
    const [kept, setKept] = d2(void 0);
    const step2 = p3.checks[s3.key];
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
    return (
      // Its .env name shows on hover, and under it while searching.
      /* @__PURE__ */ u3("div", { class: "setting" + (toggle ? " toggle" : "") + (p3.focus.includes(s3.key) ? " focus" : "") + (p3.wanted.has(s3.key) ? "" : " more"), id: "setting-" + s3.key, hidden, children: [
        /* @__PURE__ */ u3("div", { class: "key", title: s3.key, children: [
          /* @__PURE__ */ u3("span", { class: "label", children: label }),
          /* @__PURE__ */ u3("code", { children: s3.key })
        ] }),
        buttons.length ? /* @__PURE__ */ u3("div", { class: "inputrow", children: [
          input,
          buttons
        ] }) : input,
        /* @__PURE__ */ u3("div", { class: "test" + (result ? " " + result.tone : ""), hidden: !result, children: result?.text }),
        s3.help && /* @__PURE__ */ u3("div", { class: "help", children: plainHelp(s3.help, toggle) }),
        step2 && step2.state !== "waiting" && /* @__PURE__ */ u3("div", { class: "check " + (step2.state === "done" ? "ok" : "warn"), children: step2.state === "done" ? `✓ ${step2.title}` : `${step2.title}: ${step2.detail || "to do"}` })
      ] })
    );
  }
  function Form(p3) {
    const [edits, setEdits] = d2({});
    const edit = (key2, value) => {
      setEdits((old) => {
        const next = { ...old };
        if (value === void 0) delete next[key2];
        else next[key2] = value;
        p3.on.edited(next);
        return next;
      });
    };
    const show2 = shown(p3.pages, p3.view, p3.wanted, p3.label, p3.checks);
    const searching = !!p3.view.query.trim();
    return /* @__PURE__ */ u3(S, { children: p3.pages.map((pg) => /* @__PURE__ */ u3("div", { class: "group", "data-page": pg.name, "data-kind": pg.kind, hidden: !show2.counts[pg.name], children: [
      /* @__PURE__ */ u3("h2", { hidden: !searching, children: pg.name }),
      pg.items.map((s3) => /* @__PURE__ */ u3(Row3, { s: s3, p: p3, value: edits[s3.key], hidden: !show2.keys.has(s3.key), edit }, s3.key))
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
    return /* @__PURE__ */ u3(Row, { dot: "ok", title: p3.name, sub: [p3.email, apps.length ? `${apps.length} app${apps.length === 1 ? "" : "s"}` : "every app"].filter(Boolean).join(" · "), end: /* @__PURE__ */ u3(S, { children: [
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
    ] }) });
  }
  function AddPerson({ apps, open, on }) {
    const [name, setName] = d2("");
    const [email, setEmail] = d2("");
    const [picked, setPicked] = d2(/* @__PURE__ */ new Set());
    const [busy, setBusy] = d2(false);
    const toggle = (id2, on2) => setPicked((s3) => {
      const n2 = new Set(s3);
      if (on2) n2.add(id2);
      else n2.delete(id2);
      return n2;
    });
    const add = async () => {
      const who = name.trim();
      if (!who) {
        document.getElementById("personName")?.focus();
        return;
      }
      setBusy(true);
      const ok = await on.act("add", who, email.trim(), apps.map((a3) => a3.id).filter((id2) => picked.has(id2)));
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
  function People({ people, pocket, apps, log: log2, on }) {
    const here = people.filter(active);
    const head = /* @__PURE__ */ u3(CardHead, { title: "People", children: /* @__PURE__ */ u3("span", { class: "muted", children: here.length ? `${here.length} in the household` : "just you so far" }) });
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
      !!here.length && /* @__PURE__ */ u3(Rows, { children: here.map((p3) => /* @__PURE__ */ u3(Person, { p: p3, on }, p3.username)) }),
      /* @__PURE__ */ u3(AddPerson, { apps, open: !here.length, on }),
      /* @__PURE__ */ u3("pre", { id: "peopleLog", hidden: !log2, children: log2 })
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
      /* @__PURE__ */ u3(CardHead, { title: "Phones", children: /* @__PURE__ */ u3("span", { class: "muted", children: phones.length ? `${phones.length} paired` : "none paired yet" }) }),
      /* @__PURE__ */ u3("p", { class: "muted", children: "Status and Backups on your phones, at home and on the tailnet (never on the internet). Each phone pairs once with a code; it can only look unless you let it make changes." }),
      !!phones.length && /* @__PURE__ */ u3(Rows, { children: phones.map((p3) => /* @__PURE__ */ u3(
        Row,
        {
          dot: p3.canChange ? "warn" : "ok",
          title: p3.name,
          sub: /* @__PURE__ */ u3(S, { children: [
            p3.canChange ? "Can make changes" : p3.unencrypted ? "Looks only (paired over the home Wi-Fi, without encryption)" : "Looks only",
            " · last seen ",
            ago(p3.lastSeen)
          ] }),
          end: /* @__PURE__ */ u3(S, { children: [
            !p3.unencrypted && /* @__PURE__ */ u3("button", { class: "small", title: p3.canChange ? "Only look from now on" : "Let it start, stop, restart, update, and back up", onClick: () => on.setCanChange(p3.id, !p3.canChange), children: p3.canChange ? "Make read-only" : "Allow changes" }),
            /* @__PURE__ */ u3("button", { class: "small", title: "Unpair it: it stops working at once", onClick: () => on.remove(p3.id), children: "Remove" })
          ] })
        },
        p3.id
      )) }),
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

  // web/src/settings/Nav.tsx
  function PageButton({ name, active: active2, counts, pick, inFold }) {
    return /* @__PURE__ */ u3("button", { class: "pagebtn" + (inFold ? " infold" : "") + (!counts && name === active2 ? " active" : "") + (counts && !counts[name] ? " nomatch" : ""), "data-page": name, onClick: () => pick(name), children: [
      /* @__PURE__ */ u3("span", { children: name }),
      /* @__PURE__ */ u3("span", { class: "n", children: counts && counts[name] ? String(counts[name]) : "" })
    ] }, name);
  }
  function Nav({ groups, active: active2, counts, pick }) {
    const [picked, setPicked] = d2({});
    const matches2 = (f4) => !!counts && f4.pages.some((p3) => counts[p3]);
    const isOpen = (f4) => counts ? matches2(f4) : picked[f4.label] ?? f4.pages.includes(active2);
    return /* @__PURE__ */ u3(S, { children: groups.filter((g2) => g2.items.length).map((g2) => [
      /* @__PURE__ */ u3("div", { class: "navhead", children: g2.head }, "h:" + g2.head),
      ...g2.items.map((item) => {
        if (typeof item === "string") return /* @__PURE__ */ u3(PageButton, { name: item, active: active2, counts, pick }, item);
        const f4 = item, open = isOpen(f4);
        const n2 = counts ? f4.pages.reduce((sum, p3) => sum + (counts[p3] || 0), 0) : f4.pages.length;
        return [
          /* @__PURE__ */ u3(
            "button",
            {
              class: "navfold" + (open ? " open" : "") + (counts && !n2 ? " nomatch" : ""),
              "aria-expanded": open,
              onClick: () => setPicked({ ...picked, [f4.label]: !open }),
              children: [
                /* @__PURE__ */ u3("span", { children: [
                  /* @__PURE__ */ u3(Icon, { name: "chevron" }),
                  f4.label
                ] }),
                /* @__PURE__ */ u3("span", { class: "n", children: n2 ? String(n2) : "" })
              ]
            },
            "f:" + f4.label
          ),
          ...open ? f4.pages.map((name) => /* @__PURE__ */ u3(PageButton, { name, active: active2, counts, pick, inFold: true }, name)) : []
        ];
      })
    ]) });
  }
  function mountNav(el, props) {
    R(/* @__PURE__ */ u3(Nav, { ...props }), el);
  }

  // web/src/parts/Segmented.tsx
  function Segmented({ label, value, options, pick }) {
    return /* @__PURE__ */ u3("div", { class: "seg", role: "radiogroup", "aria-label": label, children: options.map(([v3, text]) => /* @__PURE__ */ u3("button", { type: "button", role: "radio", "aria-checked": value === v3, class: value === v3 ? "on" : "", onClick: () => pick(v3), children: text }, v3)) });
  }

  // web/src/settings/Appearance.tsx
  var swatches = [
    ["Blue", "#2563eb"],
    ["Purple", "#7c3aed"],
    ["Pink", "#db2777"],
    ["Red", "#dc2626"],
    ["Orange", "#ea580c"],
    ["Yellow", "#ca8a04"],
    ["Green", "#16a34a"],
    ["Teal", "#0d9488"],
    ["Graphite", "#52525b"]
  ];
  function Choice({ label, value, options, pick }) {
    return /* @__PURE__ */ u3("div", { class: "look-row", children: [
      /* @__PURE__ */ u3("span", { class: "look-label", children: label }),
      /* @__PURE__ */ u3(Segmented, { label, value, options, pick })
    ] });
  }
  function Colours({ label, value, system, systemLabel, pick }) {
    const custom = !!value && value.startsWith("#") && !swatches.some(([, c3]) => c3 === value);
    return /* @__PURE__ */ u3("div", { class: "look-row", role: "radiogroup", "aria-label": label, children: [
      /* @__PURE__ */ u3("span", { class: "look-label", children: label }),
      /* @__PURE__ */ u3("div", { class: "swatches", children: [
        /* @__PURE__ */ u3(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": !value,
            title: systemLabel,
            class: "swatch system" + (!value ? " on" : ""),
            style: system ? { "--c": system } : void 0,
            onClick: () => pick(""),
            children: /* @__PURE__ */ u3("span", { class: "sr", children: systemLabel })
          }
        ),
        swatches.map(([name, c3]) => /* @__PURE__ */ u3(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": value === c3,
            title: name,
            class: "swatch" + (value === c3 ? " on" : ""),
            style: { "--c": c3 },
            onClick: () => pick(c3),
            children: /* @__PURE__ */ u3("span", { class: "sr", children: name })
          },
          c3
        )),
        /* @__PURE__ */ u3("label", { class: "swatch any" + (custom ? " on" : ""), title: "Any colour…", style: custom ? { "--c": value } : void 0, children: /* @__PURE__ */ u3(
          "input",
          {
            type: "color",
            "aria-label": label + ": any colour",
            value: value.startsWith("#") ? value : "#2563eb",
            onInput: (e3) => pick(e3.currentTarget.value)
          }
        ) })
      ] })
    ] });
  }
  function Appearance({ look: look2, system, noAccent, set: set2 }) {
    const put = (k3) => (v3) => set2({ ...look2, [k3]: v3 });
    const iconMode = !look2.icon ? "" : look2.icon === "accent" ? "accent" : "own";
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: "Appearance", children: /* @__PURE__ */ u3("span", { class: "muted", children: "on this computer" }) }),
      /* @__PURE__ */ u3(Choice, { label: "Theme", value: look2.theme, options: [["system", "Like the system"], ["light", "Light"], ["dark", "Dark"]], pick: put("theme") }),
      /* @__PURE__ */ u3(Colours, { label: "Accent", value: look2.accent, system: system?.light, systemLabel: system ? "The system’s accent" : "The usual blue", pick: put("accent") }),
      !system && !!noAccent && /* @__PURE__ */ u3("p", { id: "noAccent", class: "muted look-help", children: noAccent }),
      /* @__PURE__ */ u3(Choice, { label: "Contrast", value: look2.contrast, options: [["system", "Like the system"], ["more", "More"]], pick: put("contrast") }),
      /* @__PURE__ */ u3(Choice, { label: "Layout", value: look2.layout, options: [["classic", "Classic"], ["islands", "Islands"]], pick: put("layout") }),
      /* @__PURE__ */ u3("p", { class: "muted look-help", children: "Islands sets the sidebar and the page apart as panels of their own, with space around them." }),
      /* @__PURE__ */ u3(Choice, { label: "Motion", value: look2.motion, options: [["system", "Like the system"], ["less", "Less"], ["none", "None"]], pick: put("motion") }),
      /* @__PURE__ */ u3("p", { class: "muted look-help", children: "Less keeps colours fading but nothing slides, spins, or grows; None stops every animation." }),
      /* @__PURE__ */ u3(Choice, { label: "Transparency", value: look2.transparency, options: [["system", "Like the system"], ["off", "Off"]], pick: put("transparency") }),
      /* @__PURE__ */ u3("p", { class: "muted look-help", children: "Off draws the bars that float over the page, and the side panel, solid instead of see-through." }),
      /* @__PURE__ */ u3(
        Choice,
        {
          label: "Tray icon",
          value: iconMode,
          options: [["", "Usual"], ["accent", "Accent"], ["own", "Its own colour"]],
          pick: (v3) => set2({ ...look2, icon: v3 === "own" ? look2.icon.startsWith("#") ? look2.icon : look2.accent || "#2563eb" : v3 })
        }
      ),
      iconMode === "own" && /* @__PURE__ */ u3(Colours, { label: "Icon colour", value: look2.icon, systemLabel: "The usual icon", pick: (v3) => set2({ ...look2, icon: v3 }) }),
      /* @__PURE__ */ u3("p", { class: "muted look-help", children: "The icon in the menu bar (the system tray on Windows and Linux) takes its new colour within a few seconds." })
    ] });
  }
  function mountAppearance(el, props) {
    R(/* @__PURE__ */ u3(Appearance, { ...props }), el);
  }

  // web/src/differs.ts
  var systemOf = (osName2, hostOS2) => osName2 === "mac" ? "mac" : osName2 === "windows" ? "windows" : hostOS2.includes("SteamOS") ? "steamos" : "linux";
  var systemOfHost = (os) => os.startsWith("macOS") ? "mac" : os.startsWith("Windows") ? "windows" : os.includes("SteamOS") ? "steamos" : "linux";
  function appNote(id2, system) {
    if (id2 === "beszel" || id2 === "beszel-agent") {
      if (system === "mac") return "On a Mac it sees OrbStack's Linux VM, not the Mac's own processor, memory, and sensors.";
      if (system === "windows") return "On Windows it sees Docker Desktop's WSL VM, not the PC's own processor, memory, and sensors.";
    }
    if (id2 === "frigate") {
      if (system === "mac") return "On a Mac it detects on the processor: containers reach no Coral and no Apple graphics.";
      if (system === "windows") return "It detects on the processor until an NVIDIA card is added by hand through WSL 2 (Frigate's note); a USB Coral can't be passed through.";
      if (system === "linux") return "It detects on the processor until a Coral or the graphics are added by hand (Frigate's note).";
      if (system === "steamos") return "It detects on the processor until the AMD graphics are added by hand (Frigate's note).";
    }
    return "";
  }
  function trayNote(system, desktop) {
    if (system === "windows") return "Something that needs a look shows as an orange dot on the tray icon: Windows has no count on the taskbar for this kind of app.";
    if (system === "linux" && desktop !== "kde") return "The tray icon shows on GNOME only with the AppIndicator extension (Ubuntu's is on). Something that needs a look shows as a count on Ubuntu's dock, or as a dot on the tray icon.";
    return "";
  }
  function noAccentNote(system) {
    return system === "linux" ? "This desktop gives no accent colour: KDE does, and GNOME from version 47." : "";
  }

  // web/src/appearance.ts
  var written = /* @__PURE__ */ new WeakMap();
  function mediaRules() {
    const out = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const r3 of rules) if (r3 instanceof CSSMediaRule) out.push(r3);
    }
    return out;
  }
  function force(theme, contrast2) {
    for (const r3 of mediaRules()) {
      if (!written.has(r3)) written.set(r3, r3.media.mediaText);
      const was = written.get(r3);
      let now = was;
      if (/prefers-color-scheme:\s*dark/.test(was) && theme !== "system") now = theme === "dark" ? "all" : "not all";
      if (/prefers-contrast:\s*more/.test(was) && contrast2 === "more") now = "all";
      if (r3.media.mediaText !== now) r3.media.mediaText = now;
    }
  }
  var rgb = (hex) => [1, 3, 5].map((i3) => parseInt(hex.slice(i3, i3 + 2), 16));
  var toHex = (c3) => "#" + c3.map((v3) => Math.round(v3).toString(16).padStart(2, "0")).join("");
  var mix = (a3, b2, share2) => toHex(rgb(a3).map((v3, i3) => v3 + (rgb(b2)[i3] - v3) * share2));
  function luminance(hex) {
    const [r3, g2, b2] = rgb(hex).map((v3) => {
      const c3 = v3 / 255;
      return c3 <= 0.03928 ? c3 / 12.92 : ((c3 + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r3 + 0.7152 * g2 + 0.0722 * b2;
  }
  var textOn = (hex) => luminance(hex) > 0.4 ? "#0b0f19" : "#ffffff";
  function contrast(a3, b2) {
    const [hi, lo] = [luminance(a3), luminance(b2)].sort((x2, y3) => y3 - x2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function linkOn(hex, dark) {
    const page = dark ? mix("#36363a", hex, 0.15) : mix("#e6e6ea", hex, 0.1);
    let c3 = hex;
    for (let i3 = 1; contrast(c3, page) < 4.5 && i3 <= 20; i3++) c3 = mix(hex, dark ? "#ffffff" : "#000000", i3 * 0.05);
    return c3;
  }
  function primaryOn(hex, text) {
    if (luminance(hex) > 0.4) return [hex, text || "#0b0f19"];
    let c3 = hex;
    for (let i3 = 1; contrast(c3, "#ffffff") < 4.5 && i3 <= 20; i3++) c3 = mix(hex, "#000000", i3 * 0.05);
    return [c3, "#ffffff"];
  }
  var setPrimary = (root, name, hex, text) => {
    const [bg, fg] = primaryOn(hex, text);
    root.style.setProperty(`--${name}`, bg);
    root.style.setProperty(`--${name}-text`, fg);
  };
  var query = (q2) => typeof matchMedia === "function" ? matchMedia(q2) : null;
  var reduceMotion = query("(prefers-reduced-motion: reduce)");
  var reduceTransparency = query("(prefers-reduced-transparency: reduce)");
  var lastLook = null;
  var follow = () => {
    if (lastLook) applyMotion(lastLook);
  };
  reduceMotion?.addEventListener?.("change", follow);
  reduceTransparency?.addEventListener?.("change", follow);
  function applyMotion(look2) {
    lastLook = look2;
    const root = document.documentElement;
    const motion = look2.motion === "none" ? "none" : look2.motion === "less" || reduceMotion?.matches ? "less" : "full";
    root.classList.toggle("motion-less", motion !== "full");
    root.classList.toggle("motion-none", motion === "none");
    root.classList.toggle("no-blur", look2.transparency === "off" || !!reduceTransparency?.matches);
  }
  function applyAppearance(look2, sys) {
    const root = document.documentElement;
    force(look2.theme, look2.contrast);
    applyMotion(look2);
    root.classList.toggle("islands", look2.layout === "islands");
    root.classList.toggle("user-accent", !!look2.accent);
    root.classList.toggle("sys-accent", !!sys && !look2.accent);
    if (sys && !look2.accent) {
      root.style.setProperty("--sys-accent-light", sys.light);
      root.style.setProperty("--sys-accent-dark", sys.dark);
      root.style.setProperty("--sys-link-light", linkOn(sys.light, false));
      root.style.setProperty("--sys-link-dark", linkOn(sys.dark, true));
      setPrimary(root, "sys-primary-light", sys.light, sys.text);
      setPrimary(root, "sys-primary-dark", sys.dark, sys.text);
    }
    if (sys?.text && !look2.accent) root.style.setProperty("--accent-text", sys.text);
    else root.style.removeProperty("--accent-text");
    if (look2.accent) {
      const dark = mix(look2.accent, "#ffffff", 0.3);
      root.style.setProperty("--user-accent-light", look2.accent);
      root.style.setProperty("--user-accent-dark", dark);
      root.style.setProperty("--user-accent-text-light", textOn(look2.accent));
      root.style.setProperty("--user-accent-text-dark", textOn(dark));
      root.style.setProperty("--user-link-light", linkOn(look2.accent, false));
      root.style.setProperty("--user-link-dark", linkOn(dark, true));
      setPrimary(root, "user-primary-light", look2.accent);
      setPrimary(root, "user-primary-dark", dark);
    }
  }

  // web/src/setup/Host.tsx
  function Fact({ k: k3, children }) {
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
        /* @__PURE__ */ u3(Rows, { children: jobs.map((j3) => /* @__PURE__ */ u3(Row, { dot: j3.installed ? "ok" : "", title: j3.name, sub: j3.what, when: j3.installed ? j3.when : "not installed", whenTitle: j3.label }, j3.label)) }),
        /* @__PURE__ */ u3("p", { class: "muted small", children: [
          on.whereBackground(),
          " They only work on the homelab, and only use power while they run. Uninstalling (homelab uninstall) removes every one."
        ] }),
        jobs.some((j3) => j3.installed && j3.label !== "tray") && /* @__PURE__ */ u3("button", { id: "bgOff", class: "small", title: "The apps keep running, but nothing starts them after a restart, backs them up at night, or watches them. Setup offers to put the jobs back.", onClick: on.jobsOff, children: "Turn the scheduled jobs off" })
      ] }) })
    ] });
  }
  function Flip({ id: id2, on, yes, no, turnOn, turnOff, set: set2 }) {
    const [busy, setBusy] = d2(false);
    return /* @__PURE__ */ u3(S, { children: [
      on ? /* @__PURE__ */ u3("span", { class: "ok", children: yes }) : /* @__PURE__ */ u3("span", { class: "muted", children: no }),
      " ",
      /* @__PURE__ */ u3("button", { class: "small", id: id2, disabled: busy, onClick: async () => {
        setBusy(true);
        await set2(!on);
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
    const tray = trayNote(systemOfHost(i3.os || ""), i3.desktop || "");
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(Fact, { k: "Machine", children: [
        i3.supported ? i3.osVersion || i3.os : `${i3.osVersion || i3.os} (not supported)`,
        (i3.model || i3.machine) && /* @__PURE__ */ u3("span", { class: "muted", children: " · " + (i3.model || i3.machine) })
      ] }),
      /* @__PURE__ */ u3(Fact, { k: "Container runtime", children: i3.runtimeOK ? /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("span", { class: "dot ok" }),
        i3.runtimeFound
      ] }) : /* @__PURE__ */ u3("span", { class: "bad", children: `${i3.runtime} is not ready: ${i3.runtimeHint}` }) }),
      /* @__PURE__ */ u3(Fact, { k: "Runs in the background", children: /* @__PURE__ */ u3(Background, { on }) }),
      atLogin !== null && /* @__PURE__ */ u3(Fact, { k: i3.os.startsWith("macOS") ? "Menu bar item" : "Tray icon", children: [
        /* @__PURE__ */ u3(Flip, { id: "trayAtLogin", on: atLogin, yes: `✓ starts at ${signIn(i3.os)}`, no: "only while the app is open", turnOn: `Start at ${signIn(i3.os)}`, turnOff: "Turn off", set: on.setTrayAtLogin }),
        !!tray && /* @__PURE__ */ u3("div", { id: "trayNote", class: "muted", children: tray })
      ] }),
      menu?.available && /* @__PURE__ */ u3(Fact, { k: "App menu", children: /* @__PURE__ */ u3(Flip, { id: "menuEntry", on: menu.added, yes: "✓ in the app menu", no: "opened from its file", turnOn: "Add to the app menu", turnOff: "Remove", set: on.setMenuEntry }) }),
      /* @__PURE__ */ u3(Fact, { k: "Homelab folder", children: [
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
  var signIn = (os) => os.startsWith("Windows") ? "sign-in" : "login";
  function Runtime({ i: i3, start, open }) {
    const service = (i3.os || "").startsWith("Linux");
    const moves = "This screen moves on by itself once it is running.";
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: i3.runtimeInstalled ? `Start ${i3.runtime}` : `Install ${i3.runtime}` }),
      i3.runtimeInstalled ? /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("p", { children: service ? `${i3.runtime} is installed but not running. Start it now and at every boot; your password is asked for once.` : `${i3.runtime} is installed but not running. Open it, accept what it asks the first time, and turn on starting at ${signIn(i3.os)} in its settings.` }),
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
      /* @__PURE__ */ u3(CardHead, { title: "Start your homelab" }),
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

  // web/src/setup/Health.tsx
  function facts({ h: h3, i: i3, machine }) {
    const checked = never(h3.lastCheck) ? "no check yet" : `last check ${ago(h3.lastCheck)}`;
    const agent = h3.agent === "running" ? { key: "agent", label: "Looks after the homelab", value: "Running", tone: "ok", sub: `Backs up every night at 03:30 and checks every app every 15 minutes; ${checked}`, short: "Backups and checks on" } : h3.agent === "quit" ? { key: "agent", label: "Looks after the homelab", value: "Stopped by Quit", tone: "warn", sub: "No backup or check runs until it starts again", short: "Backups and checks stopped by Quit" } : h3.agent === "stopped" ? { key: "agent", label: "Looks after the homelab", value: "Stopped", tone: "bad", sub: "No nightly backup, check, or update runs until it starts again", short: "Backups and checks stopped" } : { key: "agent", label: "Looks after the homelab", value: "Not set up", tone: "warn", sub: "Finish setting up adds it (Scheduled jobs)", short: "Backups and checks not set up" };
    const name = (i3.runtimeFound || i3.runtime || "The runtime").split(",")[0];
    const runtime = i3.runtimeOK ? { key: "runtime", label: "Runs the apps", value: name, tone: "ok", sub: (i3.runtimeFound || "").split(",").slice(1).join(",").trim() || "Running", short: name } : { key: "runtime", label: "Runs the apps", value: `${i3.runtime} is not running`, tone: "bad", sub: i3.runtimeHint || "", short: `${i3.runtime} is not running` };
    const power = h3.power === "battery" ? { key: "power", label: "Power", value: "On battery", tone: "warn", sub: `The apps sleep when ${machine} does: plug it in`, short: "On battery" } : h3.power === "plugged" ? h3.keptAwake ? { key: "power", label: "Power", value: "Plugged in", tone: "ok", sub: "Kept awake while plugged in; the screen still sleeps", short: "Plugged in" } : { key: "power", label: "Power", value: "Plugged in", tone: "warn", sub: `${cap(machine)} may sleep: keeping it awake is off in Settings`, short: "Plugged in, may sleep" } : h3.keptAwake ? { key: "power", label: "Sleep", value: "Kept awake", tone: "ok", sub: "The screen still sleeps", short: "Kept awake" } : { key: "power", label: "Sleep", value: "May sleep", tone: "warn", sub: "Keeping it awake is off in Settings; the apps go away while it sleeps", short: "May sleep" };
    const d3 = (i3.disks || [])[0];
    const free = d3 ? d3.space.replace(/\s*\(\d+%\)$/, "") : "";
    const [freeWords, ofWords] = free.includes(" free of ") ? free.split(" free of ") : [free, ""];
    const disk2 = d3 ? {
      key: "disk",
      label: `Room on ${machine}`,
      value: `${freeWords} free`,
      tone: d3.low ? "bad" : "ok",
      sub: d3.low ? d3.hint || "" : ofWords ? `of ${ofWords}` : "",
      short: `${freeWords} free`,
      used: d3.total ? Math.min(100, Math.max(1, Math.round(100 * (1 - d3.free / d3.total)))) : void 0
    } : null;
    return [agent, runtime, power, ...disk2 ? [disk2] : []];
  }
  var cap = (s3) => s3.charAt(0).toUpperCase() + s3.slice(1);
  function StartAgent({ id: id2, start }) {
    const [busy, setBusy] = d2(false);
    const go2 = async () => {
      setBusy(true);
      try {
        await start();
      } finally {
        setBusy(false);
      }
    };
    return /* @__PURE__ */ u3("button", { id: id2, class: "small", disabled: busy, onClick: go2, children: busy ? "Starting…" : "Start it" });
  }
  function HealthTiles(p3) {
    return /* @__PURE__ */ u3(S, { children: facts(p3).map((f4) => /* @__PURE__ */ u3(
      Tile,
      {
        id: "health-" + f4.key,
        label: f4.label,
        tone: f4.tone === "ok" ? "" : f4.tone,
        value: /* @__PURE__ */ u3(S, { children: [
          /* @__PURE__ */ u3("span", { class: "dot " + f4.tone }),
          f4.value
        ] }),
        sub: /* @__PURE__ */ u3(S, { children: [
          f4.used !== void 0 && /* @__PURE__ */ u3("span", { class: "storagebar", role: "meter", "aria-valuenow": f4.used, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": `${f4.used}% used`, children: /* @__PURE__ */ u3("span", { style: `width:${f4.used}%` }) }),
          /* @__PURE__ */ u3("span", { children: f4.sub }),
          f4.key === "agent" && (p3.h.agent === "stopped" || p3.h.agent === "quit") && /* @__PURE__ */ u3(StartAgent, { id: "startAgent", start: p3.startAgent })
        ] })
      },
      f4.key
    )) });
  }
  function HealthLine(p3) {
    const all = facts(p3);
    const stopped = p3.h.agent === "stopped" || p3.h.agent === "quit";
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("span", { class: "label", children: p3.machine.charAt(0).toUpperCase() + p3.machine.slice(1) }),
      all.map((f4) => /* @__PURE__ */ u3("span", { class: "item " + f4.tone, title: f4.sub, children: [
        /* @__PURE__ */ u3("span", { class: "dot " + f4.tone }),
        f4.short
      ] }, f4.key)),
      stopped && /* @__PURE__ */ u3(StartAgent, { id: "startAgentLine", start: p3.startAgent })
    ] });
  }
  var mountHealthTiles = (el, props) => R(props && /* @__PURE__ */ u3(HealthTiles, { ...props }), el);
  var mountHealthLine = (el, props) => R(props && /* @__PURE__ */ u3(HealthLine, { ...props }), el);

  // web/src/parts/Foot.tsx
  function Foot({ system, version, update, openSetup }) {
    return /* @__PURE__ */ u3(S, { children: [
      (system || version) && /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("span", { class: "part", children: system }),
        " · ",
        /* @__PURE__ */ u3("span", { class: "part", children: version })
      ] }),
      update && /* @__PURE__ */ u3(ActionLink, { id: "footUpdate", cls: "update", title: update === "ready" ? "Show the update" : "The line at the top follows it", onClick: openSetup, children: update === "ready" ? "● Update ready" : "● Updating…" })
    ] });
  }
  function mountFoot(el, props) {
    R(/* @__PURE__ */ u3(Foot, { ...props }), el);
  }

  // web/src/parts/Empty.tsx
  function Empty({ id: id2, children }) {
    return /* @__PURE__ */ u3("p", { id: id2, class: "muted empty", children });
  }

  // web/src/choose/Choose.tsx
  var starterLooks = { photos: ["photos", "var(--tint-orange)"], passwords: ["lock", "var(--tint-green)"], movies: ["film", "var(--tint-red)"], music: ["music", "var(--tint-pink)"], files: ["folder", "var(--tint-blue)"] };
  var lit = (p3, selected2) => !!p3.apps.length && p3.apps.every((id2) => selected2.has(id2));
  function Starters({ presets, selected: selected2, status, toggle }) {
    return /* @__PURE__ */ u3(S, { children: presets.map((p3) => {
      const running3 = p3.apps.every((id2) => status[id2]?.state === "running");
      const [glyph, tint] = starterLooks[p3.id] || [];
      return /* @__PURE__ */ u3("button", { class: "starter" + (lit(p3, selected2) ? " on" : ""), onClick: () => toggle(p3), children: [
        glyph && /* @__PURE__ */ u3("span", { class: "glyph", style: `--tint:${tint}`, children: /* @__PURE__ */ u3(Icon, { name: glyph }) }),
        /* @__PURE__ */ u3("strong", { children: p3.name }),
        /* @__PURE__ */ u3("span", { class: "desc", children: p3.description || "" }),
        running3 && /* @__PURE__ */ u3("span", { class: "state", children: "Running" })
      ] }, p3.id);
    }) });
  }
  function Bundles({ presets, selected: selected2, toggle }) {
    return /* @__PURE__ */ u3(S, { children: presets.map((p3) => /* @__PURE__ */ u3("button", { class: "chip" + (lit(p3, selected2) ? " on" : ""), title: p3.description || "", onClick: () => toggle(p3), children: p3.name }, p3.id)) });
  }
  var matches = (a3, query3) => !query3 || [a3.name, a3.id, a3.description, ...a3.replaces || [], ...a3.aliases || []].join(" ").toLowerCase().includes(query3);
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
        !!p3.note(a3.id) && /* @__PURE__ */ u3("div", { class: "sysnote muted", children: p3.note(a3.id) }),
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
    if (p3.query && !Object.keys(byCategory).length) return /* @__PURE__ */ u3(Empty, { children: [
      "No app matches “",
      p3.query,
      "”. Add your own below."
    ] });
    return /* @__PURE__ */ u3(S, { children: p3.catalog.categories.filter((c3) => byCategory[c3.id]).map((c3) => {
      const apps = byCategory[c3.id];
      const running3 = apps.filter((a3) => p3.status[a3.id]?.state === "running").length;
      return /* @__PURE__ */ u3("div", { class: "group", children: [
        /* @__PURE__ */ u3("h2", { children: [
          c3.label,
          /* @__PURE__ */ u3("span", { class: "n", children: [
            running3,
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
    const picked = p3.start.filter((id2) => !p3.added[id2]);
    const helpers = p3.start.filter((id2) => p3.added[id2]);
    const running3 = p3.skips.filter((s3) => /^already running/.test(s3.reason));
    const quiet = p3.skips.filter((s3) => /^only needed by/.test(s3.reason));
    const outside = p3.skips.filter((s3) => /^(runs natively|is installed on)/.test(s3.reason));
    const needs = p3.skips.filter((s3) => !running3.includes(s3) && !quiet.includes(s3) && !outside.includes(s3));
    const lead = picked.length ? `Installs ${plural(picked.length, "app", "apps")}` + (helpers.length ? `, with ${plural(helpers.length, "helper", "helpers")} they need` : "") + "." : "";
    const details = [
      { title: "Helpers that start with them", items: helpers.map((id2) => `${appName2(id2)} (for ${appName2(p3.added[id2])})`) },
      { title: "Port changes", items: p3.portChanges.map((c3) => `${c3.var}: ${c3.from} → ${c3.to} (${c3.reason})`) },
      { title: "Settings written", items: p3.envChanges.map((c3) => c3.secret ? `${c3.key} (hidden)` : `${c3.key} = ${c3.value}`) }
    ].filter((d3) => d3.items.length);
    return /* @__PURE__ */ u3(S, { children: [
      lead && /* @__PURE__ */ u3("p", { class: "planLead", children: lead }),
      !!picked.length && /* @__PURE__ */ u3("ul", { class: "ok planApps", children: picked.map((id2) => /* @__PURE__ */ u3("li", { children: appName2(id2) }, id2)) }),
      /* @__PURE__ */ u3(List, { title: "Waiting for a setting", cls: "warn", items: needs.map((s3) => /* @__PURE__ */ u3("span", { children: [
        /* @__PURE__ */ u3("strong", { children: appName2(s3.app) }),
        ": ",
        reason(s3.reason)
      ] })) }),
      /* @__PURE__ */ u3(List, { title: "Runs outside the homelab", items: outside.map((s3) => /* @__PURE__ */ u3("span", { children: [
        /* @__PURE__ */ u3("strong", { children: appName2(s3.app) }),
        " ",
        reason(s3.reason)
      ] })) }),
      /* @__PURE__ */ u3(List, { title: "Problems", cls: "bad", items: p3.problems }),
      /* @__PURE__ */ u3(List, { title: "Worth knowing", cls: "warn", items: p3.warnings }),
      !!running3.length && /* @__PURE__ */ u3("p", { class: "muted small", children: [
        "Already running: ",
        running3.map((s3) => appName2(s3.app)).join(", "),
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

  // web/src/job/Apps.tsx
  var reached = {
    waiting: 0.05,
    downloading: 0.1,
    downloaded: 0.6,
    building: 0.3,
    "setting-up": 0.7,
    replacing: 0.7,
    starting: 0.85,
    running: 1,
    stopping: 0.5,
    stopped: 1,
    removing: 0.5,
    removed: 1,
    failed: 1
  };
  function share(u4) {
    if (u4.stage === "downloading" && u4.percent >= 0) return 0.1 + 0.5 * (u4.percent / 100);
    return reached[u4.stage] ?? 0.1;
  }
  function overall(apps) {
    return apps.length ? apps.reduce((t3, u4) => t3 + share(u4), 0) / apps.length : 0;
  }
  function Mark({ u: u4 }) {
    if (u4.failed) return /* @__PURE__ */ u3("span", { class: "jobmark bad", "aria-hidden": "true", children: "!" });
    if (u4.done) return /* @__PURE__ */ u3("span", { class: "jobmark ok", "aria-hidden": "true", children: "✓" });
    return /* @__PURE__ */ u3("span", { class: "jobmark busy", "aria-hidden": "true" });
  }
  function JobApps({ apps }) {
    if (!apps.length) return null;
    return /* @__PURE__ */ u3("ul", { class: "jobapps", "aria-label": "Apps", children: apps.map((u4) => /* @__PURE__ */ u3("li", { class: u4.failed ? "failed" : u4.done ? "done" : "", children: [
      /* @__PURE__ */ u3(Mark, { u: u4 }),
      /* @__PURE__ */ u3("span", { class: "jobname", children: u4.name }),
      /* @__PURE__ */ u3("span", { class: "jobwords", title: u4.words, children: u4.failed ? `Couldn’t finish: ${u4.words}` : u4.words }),
      /* @__PURE__ */ u3(
        "span",
        {
          class: "jobbar" + (!u4.done && u4.percent < 0 ? " moving" : ""),
          role: "progressbar",
          "aria-label": u4.name,
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-valuenow": Math.round(share(u4) * 100),
          children: /* @__PURE__ */ u3("span", { style: { width: `${Math.round(share(u4) * 100)}%` } })
        }
      )
    ] }, u4.app)) });
  }
  function mountJobApps(el, apps) {
    R(/* @__PURE__ */ u3(JobApps, { apps }), el);
  }

  // web/src/choose/Started.tsx
  function Started({ started, open }) {
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: "Ready to open" }),
      started.length ? /* @__PURE__ */ u3("ul", { children: started.map((s3) => /* @__PURE__ */ u3("li", { children: s3.url ? /* @__PURE__ */ u3(ActionLink, { onClick: () => open(s3.url), children: s3.name }) : s3.name }, s3.id)) }) : /* @__PURE__ */ u3("p", { class: "muted", children: "Nothing new to start." })
    ] });
  }
  var marks = { done: ["✓", "ok"], already: ["✓", "ok"], manual: ["!", "warn"], failed: ["✗", "bad"] };
  function Wiring({ links, note }) {
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: "Connected for you" }),
      /* @__PURE__ */ u3("p", { class: "muted", children: note }),
      /* @__PURE__ */ u3("ul", { class: "links", children: links.map((l3, i3) => {
        const [mark, cls] = marks[l3.state] || ["•", "muted"];
        return /* @__PURE__ */ u3("li", { children: [
          /* @__PURE__ */ u3("span", { class: cls, children: [
            mark,
            " "
          ] }),
          l3.text,
          l3.detail && /* @__PURE__ */ u3("span", { class: "detail", children: l3.detail })
        ] }, i3);
      }) })
    ] });
  }
  function mountStarted(el, props) {
    R(/* @__PURE__ */ u3(Started, { ...props }), el);
  }
  function mountWiring(el, props) {
    R(/* @__PURE__ */ u3(Wiring, { ...props }), el);
  }
  function mountCategories(el, categories) {
    R(/* @__PURE__ */ u3(S, { children: categories.map((c3) => /* @__PURE__ */ u3("option", { value: c3.id, children: c3.label }, c3.id)) }), el);
  }

  // web/src/core.ts
  var go = () => window.go.main.App;
  var $2 = (id2) => document.getElementById(id2);
  var $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  var $1 = (sel, root = document) => root.querySelector(sel);
  var errorTimer = 0;
  function showError(e3) {
    const el = $2("error");
    el.textContent = String(e3 && e3.message || e3);
    el.hidden = false;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => el.hidden = true, 6e3);
  }
  var platform = navigator.platform || navigator.userAgent;
  var osName = /Mac/.test(platform) ? "mac" : /Win/.test(platform) ? "windows" : "linux";
  document.documentElement.classList.add("os-" + osName);
  var isMac = osName === "mac";
  var thisMachine = isMac ? "This Mac" : osName === "windows" ? "This PC" : "This machine";
  var mod = isMac ? "⌘" : "Ctrl+";
  var minute = 6e4;
  var errorText = (e3) => String(e3 && e3.message || e3);

  // web/src/jobs.ts
  var jobBox = "cli";
  function endJob() {
    jobBox = "cli";
  }
  var jobRows = {};
  var jobSteps = false;
  function startJob(box) {
    jobBox = box;
    jobRows = {};
    jobSteps = false;
    mountJobApps($2(box + "Apps"), []);
    const d3 = $2(box + "Details");
    if (d3) {
      d3.open = true;
      delete d3.dataset.touched;
    }
    cliProgress(null);
  }
  function jobApp(u4) {
    const fresh = !jobRows[u4.app];
    jobRows[u4.app] = u4;
    const rows = Object.values(jobRows);
    mountJobApps($2(jobBox + "Apps"), rows);
    const d3 = $2(jobBox + "Details");
    if (d3 && fresh && !d3.dataset.touched) d3.open = false;
    if (jobSteps) return;
    const box = $2(jobBox + "Progress");
    if (!box) return;
    const ready2 = rows.filter((r3) => r3.done && !r3.failed).length;
    box.hidden = false;
    box.classList.remove("failed");
    box.querySelector(".fill").style.width = `${Math.round(overall(rows) * 100)}%`;
    box.querySelector(".step").textContent = rows.length === 1 ? rows[0].words : `${ready2} of ${rows.length} apps ready`;
  }
  document.addEventListener("click", (e3) => {
    const d3 = e3.target.closest?.(".jobdetails > summary")?.parentElement;
    if (d3) d3.dataset.touched = "1";
  });
  function namesFor(text) {
    const byID = Object.fromEntries((catalog?.apps || []).map((a3) => [a3.id, a3.name]));
    return text.replace(/[a-z0-9][a-z0-9-]*[a-z0-9]/g, (w3) => byID[w3] || w3);
  }
  function cliProgress(s3) {
    const box = $2(jobBox + "Progress");
    if (!s3) {
      box.hidden = true;
      return;
    }
    const fill = box.querySelector(".fill"), step2 = box.querySelector(".step");
    if (s3 === "done" || s3 === "failed") {
      if (box.hidden) return;
      fill.style.width = "100%";
      box.classList.toggle("failed", s3 === "failed");
      step2.textContent = s3 === "done" ? "Done" : "Stopped with a problem: Show details says where";
      return;
    }
    if (s3.total < 2) return;
    jobSteps = true;
    box.hidden = false;
    box.classList.remove("failed");
    const within = s3.percent ? s3.percent / 100 : 0.5;
    fill.style.width = `${Math.round((s3.n - 1 + within) / s3.total * 100)}%`;
    step2.textContent = `${namesFor(s3.text)}${s3.percent ? ` · ${s3.percent}%` : ""} · ${s3.n} of ${s3.total}`;
  }

  // web/src/screens/choose.ts
  var catalog = null;
  var selected = /* @__PURE__ */ new Set();
  var settings = {};
  var appName = (id2) => (catalog.apps.find((a3) => a3.id === id2) || { name: id2 }).name;
  async function loadCatalog() {
    try {
      catalog = await go().Catalog();
    } catch (e3) {
      catalogProblem($2("groups"), String(e3));
      return;
    }
    statusData.fresh(minute);
    fillCategories();
    const starters = catalog.presets.filter((p3) => p3.starter);
    $2("starterBox").hidden = !starters.length;
    if (!starters.length) $2("more").open = true;
    renderApps();
  }
  $2("search").oninput = (e3) => {
    query2 = e3.target.value.trim().toLowerCase();
    if (query2) $2("more").open = true;
    $2("choose").classList.toggle("searching", !!query2);
    renderApps();
  };
  function fillCategories() {
    mountCategories($2("cCategory"), catalog.categories);
    $2("cCategory").value = "documents";
  }
  $2("cAdd").onclick = async () => {
    const log2 = $2("cLog");
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
    log2.hidden = false;
    log2.textContent = "";
    $2("cAdd").disabled = true;
    const off = window.runtime.EventsOn("cli:log", (line) => {
      log2.textContent += line + "\n";
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
      for (const id2 of ["cName", "cImage", "cPort", "cDesc", "cVolumes"]) $2(id2).value = "";
    } catch (e3) {
      showError(e3);
    } finally {
      if (typeof off === "function") off();
      $2("cAdd").disabled = false;
    }
  };
  var query2 = "";
  function togglePreset(p3) {
    const on = p3.apps.every((id2) => selected.has(id2));
    p3.apps.forEach((id2) => on ? selected.delete(id2) : selected.add(id2));
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
      query: query2,
      tick: (id2, on) => {
        if (on) selected.add(id2);
        else selected.delete(id2);
        renderApps();
        replan();
      },
      open: (url) => go().Open(url),
      settings: (keys) => showSettings(keys),
      note: (id2) => appNote(id2, systemOf(osName, hostOS))
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
      $2("installProgress").hidden = true;
      mountJobApps($2("installApps"), []);
      $2("started").replaceChildren();
      $2("wiring").replaceChildren();
      $2("installLog").textContent = "";
      $2("installDetails").hidden = true;
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
    $2("wireRow").hidden = ![...p3.start, ...selected].some((id2) => wireable.has(id2));
    $2("installBtn").disabled = !(p3.ready && p3.start.length);
  }
  function friendlyReason(r3) {
    return r3.replace(/set ([A-Z0-9_]+(?:(?:, | and | or )[A-Z0-9_]+)*) in \.env first/g, (_3, keys) => "fill in " + keys.split(/, | and | or /).map(settingLabel).join(" and ") + " below");
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
    startJob("install");
    $2("started").replaceChildren();
    $2("wiring").replaceChildren();
    const words = { env: "Saving your settings", folders: "Making the folders", networks: "Getting the network ready" };
    const ilog = $2("installLog");
    ilog.textContent = "";
    $2("installDetails").hidden = true;
    const offLog = window.runtime.EventsOn("install:log", (line) => {
      $2("installDetails").hidden = false;
      ilog.textContent += line + "\n";
      ilog.scrollTop = ilog.scrollHeight;
    });
    const off = window.runtime.EventsOn("progress", (ev) => {
      if (ev.error) return;
      const text = ev.name === "start" ? `Starting ${(ev.apps || []).map(appName).join(", ")}` : words[ev.name];
      cliProgress({ n: ev.step, total: ev.steps + 1, text });
    });
    try {
      const started = await go().Install([...selected], filled());
      cliProgress("done");
      mountStarted($2("started"), { started, open: (url) => go().Open(url) });
      if (!$2("wireRow").hidden && $2("wire").checked && started.length) await wire($2("wiring"));
      selected.clear();
      settingsData.stale();
      await loadStatus();
    } catch (e3) {
      cliProgress("failed");
      showError(e3);
    } finally {
      if (typeof off === "function") off();
      if (typeof offLog === "function") offLog();
      btn.textContent = "Install";
      installing = false;
      replan();
    }
  };
  async function wire(box) {
    const done = [];
    let note = "Connecting… this can take a minute while new apps start.";
    const draw3 = () => mountWiring(box, { links: [...done], note });
    draw3();
    const off = window.runtime.EventsOn("link", (l3) => {
      done.push(l3);
      draw3();
    });
    try {
      const links = await go().Wire();
      note = links.length ? "" : "Nothing to connect: none of the apps it links is running.";
      draw3();
    } catch (e3) {
      showError(e3);
    } finally {
      if (typeof off === "function") off();
    }
  }
  $2("connect").onclick = () => wire($2("statusWiring"));

  // web/src/updates/UpdateLine.tsx
  var running = (step2) => !!step2 && step2.step !== "done" && step2.step !== "failed";
  var lineShown = (s3, step2) => !!step2 || !!s3 && (s3.state === "ready" || s3.state === "blocked" || !!s3.updated);
  function Notes({ notes }) {
    return /* @__PURE__ */ u3("ul", { id: "updateNotes", children: [
      notes.slice(0, 12).map((n2, i3) => /* @__PURE__ */ u3("li", { children: n2 }, i3)),
      notes.length > 12 && /* @__PURE__ */ u3("li", { class: "muted", children: `and ${notes.length - 12} more` })
    ] });
  }
  function UpdateLine({ s: s3, step: step2, download: download2, log: log2, update, later: later2, close: close2, open }) {
    const [more, setMore] = d2(false);
    const v3 = s3.version;
    const whatsNew = (notes) => !!notes.length && /* @__PURE__ */ u3(ActionLink, { id: "updateWhatsNew", cls: "small", onClick: () => setMore(!more), children: more ? "Hide" : "What’s new" });
    let mark = "↑", tone = "ready", head = "", sub = "", end = null, below = null, bar = -1;
    if (running(step2)) {
      mark = "↻";
      head = s3.finish ? "Finishing the update…" : "Updating…";
      sub = "Your apps keep running";
      bar = step2.step === "app" && download2 && download2.percent >= 0 ? 60 + Math.round(download2.percent * 0.35) : step2.percent;
    } else if (step2?.step === "failed") {
      mark = "!";
      tone = "failed";
      head = "The update stopped";
      sub = step2.error || "The details say why";
      end = /* @__PURE__ */ u3(S, { children: [
        !!log2 && /* @__PURE__ */ u3(ActionLink, { id: "updateDetails", cls: "small", onClick: () => setMore(!more), children: more ? "Hide the details" : "Details" }),
        /* @__PURE__ */ u3("button", { id: "updateRetry", class: "small", onClick: update, children: "Try again" })
      ] });
      below = more && !!log2 && /* @__PURE__ */ u3("pre", { id: "updateLog", children: log2 });
    } else if (s3.updated && (step2?.step === "done" || s3.state !== "ready")) {
      mark = "✓";
      tone = "done";
      head = s3.updated.version ? `Updated to ${s3.updated.version}` : "Updated";
      end = /* @__PURE__ */ u3(S, { children: [
        whatsNew(s3.updated.notes || []),
        /* @__PURE__ */ u3("button", { id: "updateClose", class: "iconbtn", "aria-label": "Close", onClick: close2, children: "×" })
      ] });
      below = more && /* @__PURE__ */ u3(Notes, { notes: s3.updated.notes || [] });
    } else if (s3.state === "blocked") {
      mark = "!";
      tone = "blocked";
      head = v3 ? `Homelab Wizard ${v3} is ready` : "An update is ready";
      sub = s3.blocked || "";
      end = s3.page ? /* @__PURE__ */ u3("button", { id: "updateDownload", class: "small", onClick: () => open(s3.page), children: "Download it" }) : null;
    } else if (s3.state === "ready") {
      head = v3 ? `Homelab Wizard ${v3} is ready` : "An update is ready";
      end = /* @__PURE__ */ u3(S, { children: [
        whatsNew(s3.notes || []),
        /* @__PURE__ */ u3("button", { id: "updateLater", class: "small", onClick: later2, children: "Later" }),
        /* @__PURE__ */ u3("button", { id: "updateNow", class: "primary small", onClick: update, children: "Update now" })
      ] });
      below = more && /* @__PURE__ */ u3(Notes, { notes: s3.notes || [] });
    } else {
      return null;
    }
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("div", { class: "line " + tone, children: [
        /* @__PURE__ */ u3("span", { class: "mark", "aria-hidden": "true", children: mark }),
        /* @__PURE__ */ u3("strong", { class: "head", children: head }),
        /* @__PURE__ */ u3("span", { class: "sub muted", children: sub }),
        bar >= 0 && /* @__PURE__ */ u3("span", { class: "bar", role: "progressbar", "aria-label": "Updating", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": bar, children: /* @__PURE__ */ u3("span", { class: "fill", style: { width: `${Math.max(4, Math.min(100, bar))}%` } }) }),
        end
      ] }),
      below
    ] });
  }
  function UpdateSettings({ s: s3, looking: looking2, look: look2, setInstallOnQuit: setInstallOnQuit2 }) {
    return /* @__PURE__ */ u3(Rows, { children: [
      /* @__PURE__ */ u3(
        Row,
        {
          title: "Look for updates",
          sub: "Every 15 minutes, and when you bring the window forward",
          end: /* @__PURE__ */ u3(S, { children: [
            /* @__PURE__ */ u3("span", { class: "muted small", children: looking2 ? "Looking…" : never(s3.looked) ? "Not yet" : `Last looked ${ago(s3.looked)}` }),
            /* @__PURE__ */ u3("button", { id: "lookNow", class: "small", disabled: looking2, onClick: look2, children: "Look now" })
          ] })
        }
      ),
      s3.canInstallOnQuit && /* @__PURE__ */ u3(
        Row,
        {
          title: "Install updates when I quit the app",
          sub: "A downloaded update goes in place as the app quits; the next open is the new version",
          end: /* @__PURE__ */ u3(
            "input",
            {
              id: "installOnQuit",
              type: "checkbox",
              class: "switch",
              role: "switch",
              "aria-label": "Install updates when I quit the app",
              checked: s3.installOnQuit,
              onChange: (e3) => setInstallOnQuit2(e3.currentTarget.checked)
            }
          )
        }
      )
    ] });
  }
  var mountUpdateLine = (el, props) => R(props && /* @__PURE__ */ u3(UpdateLine, { ...props }), el);
  var mountUpdateSettings = (el, props) => R(props && /* @__PURE__ */ u3(UpdateSettings, { ...props }), el);

  // web/src/screens/updates.ts
  var state = null;
  var step = null;
  var download = null;
  var log = "";
  var looking = false;
  var laterKey = "";
  var finishing = false;
  var companion = () => document.documentElement.classList.contains("companion");
  var key = (s3) => `${s3.version}|${s3.files}|${s3.app}`;
  var ready = () => state?.state === "ready";
  var running2 = () => !!step && step.step !== "done" && step.step !== "failed";
  function draw() {
    const box = $2("updateLine");
    if (companion() || !state) {
      box.hidden = true;
      mountUpdateLine(box, null);
      return;
    }
    const hidden = !running2() && step?.step !== "failed" && ready() && laterKey === key(state) && !state.updated;
    const shown3 = lineShown(state, step) && !hidden;
    box.hidden = !shown3;
    box.className = "updateline" + (step?.step === "failed" ? " failed" : state.updated && !ready() && !running2() ? " done" : "");
    mountUpdateLine(box, shown3 ? { s: state, step, download, log, update: updateNow, later, close, open: (url) => go().Open(url) } : null);
    drawFoot({ update: running2() ? "finishing" : ready() && hidden ? "ready" : "", openSetup: showLine });
    const settings2 = $2("updatesSettings");
    if (settings2) mountUpdateSettings(settings2, { s: state, looking, look: lookNow, setInstallOnQuit });
  }
  function set(s3) {
    state = s3;
    if (s3.finish && s3.state === "ready" && !finishing && !running2()) {
      finishing = true;
      updateNow();
      return;
    }
    draw();
  }
  function later() {
    if (state) laterKey = key(state);
    draw();
  }
  function showLine() {
    laterKey = "";
    draw();
  }
  function close() {
    go().ClearUpdated();
    if (state) state = { ...state, updated: void 0 };
    step = null;
    draw();
  }
  async function updateNow() {
    if (running2()) return;
    step = { step: "files", percent: 3 };
    log = "";
    laterKey = "";
    draw();
    try {
      await go().UpdateNow();
    } catch (e3) {
      if (!step || step.step !== "failed") step = { step: "failed", percent: 0, error: String(e3 && e3.message || e3) };
      draw();
    }
  }
  async function lookNow() {
    looking = true;
    draw();
    try {
      set(await go().LookForUpdates(true));
    } catch (e3) {
      showError(e3);
    }
    looking = false;
    draw();
  }
  async function setInstallOnQuit(on) {
    try {
      await go().SetInstallOnQuit(on);
    } catch (e3) {
      showError(e3);
    }
    try {
      set(await go().UpdateState());
    } catch {
    }
  }
  function cameForward() {
    if (document.hidden || companion()) return;
    go().LookForUpdates(false).then(set).catch(() => {
    });
  }
  function updateFromMenu() {
    if (ready()) updateNow();
    else showLine();
  }
  function lookForUpdates() {
    return lookNow();
  }
  if (window.runtime?.EventsOn) {
    window.runtime.EventsOn("update:state", set);
    window.runtime.EventsOn("update:step", async (e3) => {
      step = e3;
      if (e3.step === "done") {
        try {
          state = await go().UpdateState();
        } catch {
        }
        finishing = false;
      }
      draw();
    });
    window.runtime.EventsOn("app:download", (d3) => {
      download = d3;
      if (running2()) draw();
    });
    window.runtime.EventsOn("cli:log", (line) => {
      if (running2()) log += line + "\n";
    });
  }
  window.addEventListener("focus", cameForward);
  document.addEventListener("visibilitychange", cameForward);
  try {
    go().UpdateState().then(set).catch(() => {
    });
  } catch {
  }

  // web/src/screens/setup.ts
  var hostOS = "";
  function whereBackgroundIs() {
    if (hostOS.startsWith("Windows")) return "Windows starts them when you sign in: Task Manager › Startup apps lists them as homelab-run.";
    if (hostOS.startsWith("macOS") || !hostOS) return "macOS lists these in System Settings › General › Login Items & Extensions, under Homelab Wizard.";
    return "systemd runs them for you as the homelab-agent service: systemctl --user status homelab-agent shows it.";
  }
  var look = { theme: "system", accent: "", contrast: "system", layout: "classic", icon: "", motion: "system", transparency: "system" };
  var systemAccent;
  async function loadAppearance() {
    try {
      look = await go().Appearance();
    } catch {
      applyMotion(look);
      return;
    }
    applyAppearance(look, systemAccent);
  }
  async function setAppearance(next) {
    look = next;
    applyAppearance(look, systemAccent);
    renderAppearance();
    try {
      look = await go().SetAppearance(next);
    } catch (e3) {
      showError(e3);
    }
  }
  var renderAppearance = () => mountAppearance($2("appearanceCard"), { look, system: systemAccent, noAccent: noAccentNote(systemOf(osName, hostOS)), set: setAppearance });
  var hostData = store(async () => {
    const i3 = await go().Host();
    const [atLogin, menu] = await Promise.all([go().TrayAtLogin().catch(() => null), go().MenuEntry().catch(() => null)]);
    return { i: i3, atLogin, menu };
  });
  hostData.watch(drawHost);
  hostData.watch(drawHealth);
  var healthData = store(() => go().Health());
  healthData.watch(drawHealth);
  var machineWords = () => thisMachine.charAt(0).toLowerCase() + thisMachine.slice(1);
  function drawHealth() {
    const h3 = healthData.value, i3 = hostData.value?.i;
    const props = h3 && i3 && !healthData.error ? {
      h: h3,
      i: i3,
      machine: machineWords(),
      startAgent: async () => {
        try {
          await go().StartAgent();
        } catch (e3) {
          showError(e3);
        }
        await healthData.load();
      },
      openSetup: () => navigate("setup")
    } : null;
    $2("healthTiles").hidden = !props || !i3.rootOK;
    $2("healthLine").hidden = !props || !i3.rootOK;
    mountHealthTiles($2("healthTiles"), props);
    mountHealthLine($2("healthLine"), props);
  }
  async function loadHost() {
    await hostData.load();
    if (hostData.error) throw hostData.error;
    return hostData.value.i;
  }
  function drawHost() {
    if (hostData.error) return;
    const { i: i3, atLogin, menu } = hostData.value;
    hostOS = i3.os || "";
    document.documentElement.classList.toggle("backdrop", !!i3.backdrop);
    const root = document.documentElement;
    root.classList.toggle("de-kde", i3.desktop === "kde");
    systemAccent = i3.accent;
    applyAppearance(look, systemAccent);
    renderAppearance();
    host = { i: i3, atLogin, menu, upgrade: host?.upgrade || null, on: hostActions };
    renderHost();
    $2("thisMacTitle").textContent = thisMachine;
    drawFoot({ system: i3.osVersion || i3.os, version: i3.version });
    if (i3.rootOK) loadUpgrade(false);
    renderNewHomelab(i3);
    renderRuntime(i3);
  }
  function setupJob() {
    startJob("setup");
    $2("setupClear").hidden = true;
  }
  function setupJobEnded() {
    endJob();
    $2("setupClear").hidden = false;
  }
  $2("setupClear").onclick = () => {
    $2("setupProgress").hidden = true;
    $2("setupProgress").classList.remove("failed");
    mountJobApps($2("setupApps"), []);
    const log2 = $2("setupLog");
    log2.hidden = true;
    log2.textContent = "";
    $2("setupClear").hidden = true;
    setupNav();
  };
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
      navigate("setup");
      setupJob();
      const log2 = $2("setupLog");
      log2.hidden = false;
      log2.textContent = "Going back…\n";
      const off = window.runtime.EventsOn("cli:log", (line) => {
        log2.textContent += line + "\n";
        log2.scrollTop = log2.scrollHeight;
      });
      try {
        await go().Homelab("upgrade-back", "", true);
      } catch (e3) {
        showError(e3);
      }
      if (typeof off === "function") off();
      setupJobEnded();
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
  async function loadUpgrade(force2) {
    let c3;
    try {
      c3 = await go().UpgradeCheck(force2);
    } catch (e3) {
      if (host) {
        host = { ...host, upgrade: { error: String(e3 && e3.message || e3), behind: 0 } };
        renderHost();
      }
      return;
    }
    if (host) {
      host = { ...host, upgrade: { behind: c3.behind, appCommit: c3.appCommit, previous: c3.previous } };
      renderHost();
    }
  }
  window.runtime?.EventsOn?.("update:state", () => {
    if (host?.i.rootOK) loadUpgrade(false);
  });
  var foot = { system: "", version: "", update: "", openSetup: () => {
  } };
  function drawFoot(change) {
    mountFoot($2("foot"), foot = { ...foot, ...change });
  }
  $2("report").onclick = async () => {
    const log2 = $2("reportLog"), btn = $2("report");
    btn.disabled = true;
    mountReportActions($2("reportActions"), null);
    log2.hidden = false;
    log2.textContent = "Making the report (about a minute)…\n";
    const off = window.runtime.EventsOn("cli:log", (line) => {
      log2.textContent += line + "\n";
      log2.scrollTop = log2.scrollHeight;
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
      mountReportActions($2("reportActions"), { reveal, show: () => go().RevealReport().catch(showError), email: () => go().EmailReport().catch(showError) });
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
  var showLaterSteps = false;
  var runningStep = null;
  function renderSetup(steps) {
    lastSteps = steps;
    const { done, total, left, wait } = progress(steps);
    const all = !left && !wait;
    $2("checkTitle").textContent = all ? "Everything is set up" : "Finish setting up";
    $2("checkCount").textContent = all ? "" : `${done} of ${total} done`;
    $2("setupMeter").parentElement.hidden = all;
    $2("setupMeter").style.width = total ? `${Math.round(100 * done / total)}%` : "0";
    setupBadge(left);
    const ready2 = runnable(steps);
    $2("runAll").hidden = runningAll || ready2.length < 2;
    if (!runningAll) $2("runAll").textContent = `Do the ${ready2.length} I can do for you`;
    mountChecklist($2("checklist"), { steps, showDone: showDoneSteps, showLater: showLaterSteps, running: runningStep, on: checklistActions });
    setupNav();
  }
  function setupNav() {
    const btn = $1('nav button[data-screen="setup"]');
    if (!btn) return;
    const p3 = lastSteps.length ? progress(lastSteps) : null;
    const i3 = hostData.value?.i;
    const needed = !p3 || p3.left > 0 || p3.wait > 0 || !i3?.rootOK || !i3?.runtimeOK || !$2("setupClear").hidden || runningAll || !!runningStep || $2("setup").classList.contains("active");
    btn.hidden = !needed;
  }
  var checklistActions = {
    fill: (keys) => showSettings(keys),
    run: (s3, choice) => runStep(s3, choice),
    open: (url) => go().Open(url),
    closeSignups: async () => {
      const log2 = $2("setupLog");
      log2.hidden = false;
      const off = window.runtime.EventsOn("cli:log", (line) => {
        log2.textContent += line + "\n";
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
        stepsData.set(await go().MarkSetupDone(s3.id, done));
      } catch (err) {
        showError(err);
      }
    },
    toggleDone: () => {
      showDoneSteps = !showDoneSteps;
      renderSetup(lastSteps);
    },
    toggleLater: () => {
      showLaterSteps = !showLaterSteps;
      renderSetup(lastSteps);
    }
  };
  function setupBadge(left) {
    $2("setupCount").textContent = left ? String(left) : "";
  }
  var stepsData = store(() => go().Setup());
  stepsData.watch(() => {
    if (stepsData.error) return showError(stepsData.error);
    renderSetup(stepsData.value);
    if (form) drawSettings(false, false);
  });
  async function loadSetup() {
    $2("checkCount").textContent = "checking…";
    await stepsData.load();
  }
  $2("recheck").onclick = () => {
    loadSetup();
    healthData.load();
    loadHost();
    lookForUpdates();
  };
  function runnable(steps) {
    return steps.filter((s3) => s3.state === "todo" && s3.run?.length);
  }
  var runningAll = false;
  $2("runAll").onclick = async () => {
    setupJob();
    const log2 = $2("setupLog"), btn = $2("runAll");
    runningAll = true;
    btn.disabled = true;
    log2.hidden = false;
    log2.textContent = "";
    const off = window.runtime.EventsOn("setup:log", (line) => {
      log2.textContent += line + "\n";
      log2.scrollTop = log2.scrollHeight;
    });
    const tried = /* @__PURE__ */ new Set();
    try {
      for (; ; ) {
        const next = runnable(lastSteps || []).find((s3) => !tried.has(s3.id));
        if (!next) break;
        tried.add(next.id);
        btn.textContent = `Doing: ${next.title}…`;
        log2.textContent += `
— ${next.title}
`;
        stepsData.set(await go().RunSetup(next.id));
      }
      log2.textContent += "\nDone. What is left needs you: a setting to fill in, a choice, or a step only a person can do.\n";
    } catch (e3) {
      showError(e3);
      log2.textContent += "\nStopped at a step that failed: the log above says why.\n";
    } finally {
      if (typeof off === "function") off();
      setupJobEnded();
      runningAll = false;
      btn.disabled = false;
      loadSetup();
    }
  };
  async function runStep(step2, choice) {
    setupJob();
    const log2 = $2("setupLog");
    log2.hidden = false;
    log2.textContent = "";
    runningStep = step2.id;
    renderSetup(lastSteps);
    const off = window.runtime.EventsOn("setup:log", (line) => {
      log2.textContent += line + "\n";
      log2.scrollTop = log2.scrollHeight;
    });
    try {
      const steps = await (choice === void 0 ? go().RunSetup(step2.id) : go().RunSetupChoice(step2.id, choice));
      runningStep = null;
      stepsData.set(steps);
    } catch (e3) {
      runningStep = null;
      showError(e3);
      loadSetup();
    } finally {
      runningStep = null;
      if (typeof off === "function") off();
      setupJobEnded();
    }
  }

  // web/src/screens/settings.ts
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
    setCanChange: async (id2, can) => {
      try {
        await go().SetPhoneCanChange(id2, can);
      } catch (e3) {
        showError(e3);
      }
      loadPhones();
    },
    remove: async (id2) => {
      try {
        await go().RemovePhone(id2);
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
  var usedByPeople = (a3, entry) => !!(a3.address || a3.url) && a3.id !== "homepage" && entry?.kind !== "helper" && (!["network", "system", "security"].includes(entry?.category || "") || a3.id === "vaultwarden");
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
    const personal = st.apps.filter((a3) => a3.state === "running" && usedByPeople(a3, catOf[a3.id]));
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
      navigate("choose");
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
  var settingsFocus = [];
  var settingsData = store(async () => {
    loadPhones();
    loadPeople();
    const tests = testable ? null : go().SettingTests().catch(() => []);
    const list = await go().Settings();
    if (tests) testable = new Set(await tests);
    return list;
  });
  settingsData.watch(() => {
    if (settingsData.error) {
      form = null;
      formProblem($2("settingsForm"), String(settingsData.error));
      return;
    }
    drawSettings(true, true);
  });
  function loadSettings(focus = []) {
    settingsFocus = focus;
    return settingsData.load();
  }
  function drawSettings(afresh, scroll) {
    renderAppearance();
    const list = settingsData.value, focus = settingsFocus;
    if (afresh) {
      for (const k3 of Object.keys(changed)) delete changed[k3];
      markChanged();
      formVersion++;
    }
    const checks = {};
    for (const s3 of lastSteps) for (const k3 of s3.settings || []) checks[k3] = s3;
    const pages = settingsPages(list);
    const wanted = /* @__PURE__ */ new Set([...everyday, ...(catalog?.apps || []).flatMap((a3) => a3.inputs || []), ...Object.keys(checks), ...focus]);
    everydayCount = list.filter((s3) => wanted.has(s3.key)).length;
    moreCount = list.length - everydayCount;
    if (focus.length) settingsPage = pages.find((pg) => pg.items.some((s3) => s3.key === focus[0]))?.name || settingsPage;
    if (!pages.some((pg) => pg.name === settingsPage) && !extraPages.includes(settingsPage)) settingsPage = pages[0]?.name || "";
    form = { pages, wanted, focus, checks, testable, label: settingLabel, view: settingsView(), on: formActions };
    renderSettingsNav(pages);
    filterSettings();
    if (scroll && focus.length) document.getElementById("setting-" + focus[0])?.scrollIntoView({ block: "center" });
  }
  var testReads = {
    CLOUDFLARE_API_TOKEN: ["HOMELAB_DOMAIN"],
    TUNNEL_TOKEN: ["CLOUDFLARE_API_TOKEN"],
    ADGUARD_USER: ["ADGUARD_PASSWORD"],
    ADGUARD_PASSWORD: ["ADGUARD_USER"],
    NPM_API_EMAIL: ["NPM_API_PASSWORD"],
    NPM_API_PASSWORD: ["NPM_API_EMAIL"]
  };
  var form = null;
  var formVersion = 0;
  var settingsView = () => ({ query: $2("settingsSearch").value, page: settingsPage, showAll: settingsShowAll });
  var isSecret = (key2) => !!form?.pages.some((pg) => pg.items.some((s3) => s3.key === key2 && s3.secret));
  var formActions = {
    edited: (edits) => {
      for (const k3 of Object.keys(changed)) delete changed[k3];
      Object.assign(changed, edits);
      markChanged();
    },
    // The test checks the saved values, so a value just typed is saved
    // first, with the ones its test reads too (the Domain for the token).
    test: async (key2, pending2) => {
      let used = false;
      const save = {};
      for (const k3 of testReads[key2] || []) if (k3 in changed && !(isSecret(k3) && changed[k3] === "")) save[k3] = changed[k3];
      if (pending2 !== void 0) {
        if (!(isSecret(key2) && pending2 === "")) save[key2] = pending2;
        used = true;
      }
      if (Object.keys(save).length) {
        try {
          await go().SaveSettings(save);
        } catch (e3) {
          return { result: { tone: "bad", text: errorText(e3) }, used: false };
        }
      }
      try {
        const r3 = await go().TestSetting(key2);
        return { result: { tone: r3.ok ? "ok" : "bad", text: (r3.ok ? "✓ " : "✗ ") + r3.message }, used };
      } catch (e3) {
        return { result: { tone: "bad", text: errorText(e3) }, used };
      }
    },
    copy: async (key2) => {
      try {
        await go().CopySetting(key2);
        return { tone: "ok", text: "✓ Copied. Paste it into Vaultwarden; the clipboard clears in 90 seconds." };
      } catch (e3) {
        return { tone: "bad", text: errorText(e3) };
      }
    },
    choose: async (key2) => {
      try {
        return await go().ChooseFolder(key2) || "";
      } catch (e3) {
        showError(e3);
        return "";
      }
    }
  };
  var settingsPage = "";
  var extraPages = ["Appearance", "People", "Phones"];
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
    const appOf = (key2) => main(findApp(key2));
    const findApp = (key2) => {
      const own = apps.find((a3) => a3.inputs.has(key2));
      if (own) return own;
      let best = null, score = 0;
      for (const a3 of apps) {
        for (const [p3, bonus] of a3.prefixes) {
          const sc = key2.startsWith(p3) ? p3.length * 10 + bonus + (a3.helper ? 0 : 3) : 0;
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
  var pageGroups = [
    [thisMachine, [thisMachine, "Storage", "Appearance"]],
    ["Household", ["People", "Phones"]],
    ["Reaching the apps", ["Domain", "Notifications"]]
  ];
  var navGroups = [];
  function renderSettingsNav(pages) {
    const installed = (name) => Object.values(statusById || {}).some((a3) => a3.name === name && a3.state !== "missing");
    const general = [...pages.filter((p3) => p3.kind === "general").map((p3) => p3.name), ...extraPages];
    const apps = pages.filter((p3) => p3.kind === "app");
    const known = Object.keys(statusById || {}).length > 0;
    const mine = known ? apps.filter((p3) => installed(p3.name) || p3.name === "Other apps") : apps;
    const others = known ? apps.filter((p3) => !mine.includes(p3)) : [];
    const groups = pageGroups.map(([head, names]) => ({ head, items: names.filter((n2) => general.includes(n2)) }));
    const named = new Set(pageGroups.flatMap(([, names]) => names));
    groups[0].items.push(...general.filter((n2) => !named.has(n2)));
    const cats = catalog?.categories || [];
    const catOf = (name) => (catalog?.apps || []).find((a3) => a3.kind !== "helper" && (name === a3.name || name.startsWith(a3.name + " ")))?.category || "";
    const folds = cats.map((c3) => ({ label: c3.label, pages: mine.filter((p3) => p3.name !== "Other apps" && catOf(p3.name) === c3.id).map((p3) => p3.name) })).filter((f4) => f4.pages.length);
    const loose = mine.filter((p3) => p3.name !== "Other apps" && !cats.some((c3) => c3.id === catOf(p3.name))).map((p3) => p3.name);
    const other = mine.some((p3) => p3.name === "Other apps") ? ["Other apps"] : [];
    navGroups = [
      ...groups,
      { head: "Apps", items: [...loose, ...folds, ...other, ...others.length ? [{ label: "Apps you don't have", pages: others.map((p3) => p3.name) }] : []] }
    ];
  }
  function pickSettingsPage(name) {
    settingsPage = name;
    $2("settingsSearch").value = "";
    filterSettings();
    document.querySelector("main").scrollTo({ top: 0 });
  }
  function showSettingsPage(name) {
    pickSettingsPage(name);
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
    TUNNEL_TOKEN: "Cloudflare Tunnel token",
    DESKTOP_ALERTS: "Alerts on this screen",
    HELPER_EMAIL: "Your helper's email",
    HEARTBEAT_URL: "Heartbeat ping URL",
    UPDATES_PAUSED: "Pause nightly updates",
    VAULTWARDEN_SIGNUPS_ALLOWED: "Vaultwarden sign-ups open",
    TAILSCALE_AUTHKEY: "Tailscale auth key (optional)",
    TAILSCALE_HOST: "This machine on the tailnet",
    TAILNET_ADMIN_APPS: "Admin apps on the tailnet",
    PROTONVPN_WIREGUARD_PRIVATE_KEY: "ProtonVPN WireGuard key",
    PROTONVPN_SERVER_COUNTRIES: "ProtonVPN server countries",
    ADGUARD_DNS_BIND_IP: "AdGuard Home DNS listens on",
    HOST_GATEWAY: "Apps reach this machine's own apps at",
    SSO_HOST: "Pocket ID address for the apps",
    HOMEBOX_ALLOW_REGISTRATION: "Homebox sign-ups open",
    AUTO_ROLLBACK: "Undo an update that breaks an app",
    AUTO_HEAL: "Restart an app that stops answering",
    UPDATE_CHANNEL: "Homelab update channel",
    WATCHTOWER_SCHEDULE: "When apps update",
    SPEEDTEST_SCHEDULE: "When the speed test runs",
    OLLAMA_MODEL: "Model that explains logs",
    UPDATES_HELD: "Apps with updates held",
    UPDATES_HELD_CONTAINERS: "Containers with updates held",
    NTFY_PUBLISH_AUTH: "ntfy publish token, as a link",
    NTFY_READ_TOKEN: "ntfy read-only token",
    MONEYMATTER_FRONTEND_IMAGE: "MoneyMatter frontend image"
  };
  var upper = /* @__PURE__ */ new Set(["API", "URL", "DNS", "IP", "HTTP", "HTTPS", "ID", "PDF", "AI", "IGDB", "SSL", "UI", "OCR", "JWT", "SSO", "VPN"]);
  var wordLabels = { DB: "database", NEXTAUTH: "NextAuth", MEILI: "Meilisearch", SCREENSCRAPER: "ScreenScraper", NPM: "Nginx Proxy Manager" };
  var envPrefix = (t3) => t3.toUpperCase().replace(/[^A-Z0-9]+/g, "_") + "_";
  function keyApp(key2) {
    let best = null, score = 0;
    for (const a3 of catalog?.apps || []) {
      const first = envPrefix(a3.id.split("-")[0]);
      const prefixes = [envPrefix(a3.id), envPrefix(a3.name)];
      if (a3.kind !== "helper" && envPrefix(a3.name).startsWith(first)) prefixes.push(first);
      for (const p3 of prefixes) {
        const sc = key2.startsWith(p3) ? p3.length * 2 + (a3.kind === "helper" ? 0 : 1) : 0;
        if (sc > score) {
          best = [a3.name, key2.slice(p3.length)];
          score = sc;
        }
      }
    }
    return best;
  }
  function settingLabel(key2) {
    if (settingLabels[key2]) return settingLabels[key2];
    const app = keyApp(key2);
    const words = (app ? app[1] : key2).split("_").filter(Boolean).map((w3) => wordLabels[w3] || (upper.has(w3) ? w3 : w3.toLowerCase()));
    if (app) return [app[0], ...words].join(" ");
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
    for (const [id2, name] of [["thisMacCard", thisMachine], ["appearanceCard", "Appearance"], ["peopleCard", "People"], ["phonesCard", "Phones"]]) $2(id2).classList.toggle("offpage", searching || settingsPage !== name);
    mountNav($2("settingsNav"), { groups: navGroups, active: settingsPage, counts: searching ? sh.counts : null, pick: pickSettingsPage });
    $2("settingsForm").classList.toggle("searching", searching);
    $2("settingsNone").hidden = sh.keys.size > 0 || !searching;
    $2("settingsAll").hidden = searching || !sh.pageMore;
    $2("settingsAll").textContent = settingsShowAll ? "Show the everyday settings only" : `Show all settings (${sh.pageMore} more)`;
  }
  $2("settingsSearch").oninput = filterSettings;
  function showSettings(keys) {
    settingsFocus = keys;
    const kept = settingsData.at > 0;
    show("settings");
    if (kept) drawSettings(false, true);
  }
  $2("saveSettings").onclick = async () => {
    const values = {};
    for (const [k3, v3] of Object.entries(changed)) {
      if (isSecret(k3) && v3 === "") continue;
      values[k3] = v3;
    }
    try {
      await go().SaveSettings(values);
      stepsData.set(await go().Setup());
      await loadSettings(Object.keys(values));
    } catch (e3) {
      showError(e3);
    }
  };

  // web/src/screens/status.ts
  var statusById = {};
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
  var lastAttention = -1;
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
    if (n2 !== lastAttention && !document.documentElement.classList.contains("companion")) {
      lastAttention = n2;
      Promise.resolve(go().SetAttention(n2)).catch(() => {
      });
    }
    $2("fixIt").hidden = !(st.missing || st.apps.some((a3) => a3.health === "unhealthy" || a3.health === "restarting" || a3.notAnswering || a3.settingsChanged));
  }
  mountShowAll($2("statusAllBox"));
  var lastStatus = null;
  function renderAppList(st) {
    const trouble = (a3) => a3.health === "unhealthy" || a3.health === "restarting" || a3.state === "missing";
    const catOf = Object.fromEntries((catalog?.apps || []).map((x2) => [x2.id, x2.category]));
    const groups = [
      { label: "Needs a look", apps: st.apps.filter(trouble), alert: true },
      ...(catalog?.categories || []).map((c3) => ({ label: c3.label, apps: st.apps.filter((a3) => !trouble(a3) && catOf[a3.id] === c3.id) })),
      { label: "Other", apps: st.apps.filter((a3) => !trouble(a3) && !(catalog?.categories || []).some((c3) => c3.id === catOf[a3.id])) }
    ].filter((g2) => g2.apps.length);
    appList = { groups, pending, catalog, weekUp, batteryPaused, busy: appsBusy, companion: document.documentElement.classList.contains("companion"), os: osName, on: appListActions };
    mountAppList($2("statusRows"), appList);
  }
  async function answerPages(st) {
    let why;
    try {
      why = await go().Answers();
    } catch {
      return;
    }
    if (lastStatus !== st) return;
    let changed2 = false;
    for (const a3 of st.apps) {
      if (!(a3.id in why) || (a3.notAnswering || "") === why[a3.id]) continue;
      a3.notAnswering = why[a3.id] || void 0;
      changed2 = true;
    }
    st.checking = false;
    if (!changed2) return;
    renderTiles(st);
    renderAppList(st);
  }
  async function loadCrash() {
    let c3 = null;
    try {
      c3 = await go().LastCrash();
    } catch {
    }
    const seen = () => go().CrashSeen().catch(() => {
    }).then(loadCrash);
    mountCrashNote($2("crashNote"), {
      crash: c3,
      send: () => {
        seen();
        navigate("settings");
        showSettingsPage(thisMachine);
        $2("report").click();
      },
      hide: seen
    });
  }
  var statusData = store(readStatus);
  var remembered = null;
  async function drawRemembered(last) {
    let r3 = null;
    try {
      r3 = await last;
    } catch {
      return;
    }
    if (!r3 || statusData.value || statusData.error) return;
    remembered = r3;
    statusData.set(r3.status);
    statusData.stale();
  }
  statusData.watch(drawStatus);
  function loadStatus() {
    return statusData.load();
  }
  async function readStatus() {
    const watch2 = loadWatchdog();
    loadCrash();
    let st;
    try {
      [st] = await Promise.all([go().Status(), watch2, savingsHistory.length ? null : loadSavingsHistory()]);
    } catch (e3) {
      await watch2;
      throw e3;
    }
    if (Date.now() - protectionAt > 6e4) loadProtection();
    loadAlerts();
    loadStorage();
    loadUsage();
    loadWeek();
    return st;
  }
  function drawStatus() {
    const kept = !statusData.error && statusData.value === remembered?.status;
    $2("statusAge").hidden = !kept;
    if (kept) $2("statusAge").textContent = `As it was ${Date.now() - new Date(remembered.at).getTime() < 6e4 ? "a few seconds ago" : ago(remembered.at)}; checking now…`;
    if (statusData.error) {
      statusById = {};
      if (catalog) renderApps();
      appList = lastStatus = null;
      clearAppList($2("statusRows"));
      $2("statusRows").closest("table").hidden = true;
      $2("tiles").replaceChildren();
      $2("alertsCard").hidden = true;
      $2("watchCard").hidden = true;
      $2("protectCard").hidden = true;
      protectionAt = 0;
      const e3 = statusData.error;
      mountStatusNote($2("statusNote"), { text: "", down: String(e3 && e3.message || e3) });
      return;
    }
    const st = statusData.value;
    statusById = Object.fromEntries(st.apps.map((a3) => [a3.id, a3]));
    if (catalog) renderApps();
    batteryPaused = new Set(st.batteryPaused || []);
    renderTiles(st);
    $2("statusRows").closest("table").hidden = false;
    lastStatus = st;
    renderAppList(st);
    if (st.checking && !kept) answerPages(st);
    const waiting = [...new Set(st.apps.filter((a3) => a3.state === "stopped" && a3.waitingFor).map((a3) => a3.waitingFor.replace(/^\/Volumes\//, "")))];
    mountStatusNote($2("statusNote"), { text: [
      waiting.length ? `Plug in ${waiting.join(" and ")}: the apps waiting for ${waiting.length === 1 ? "it" : "them"} start within 15 minutes of ${waiting.length === 1 ? "it" : "them"} appearing.` : "",
      batteryPaused.size ? `On battery: ${batteryPaused.size} app${batteryPaused.size === 1 ? "" : "s"} paused until this computer is plugged in (Settings › Battery saver).` : "",
      st.unmatched ? `${st.unmatched} other container(s) on this machine are not catalog apps.` : ""
    ].filter(Boolean).join(" ") });
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
      navigate("setup");
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
    mountStorage(card, { rec, nameOf: (id2) => catalog?.apps.find((a3) => a3.id === id2)?.name || id2 });
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
    mountUsage($2("usageCard"), { stats, history: usageHistory, nameOf: (id2) => catalog?.apps.find((a3) => a3.id === id2)?.name || id2 });
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
      navigate("setup");
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
    openNative: (a3) => go().OpenNativeApp(a3.id).then(() => {
      setTimeout(loadStatus, 3e3);
    }, (err) => {
      showError(err);
      throw err;
    }),
    install: (a3) => {
      selected.add(a3.id);
      navigate("choose");
      renderApps();
      replan();
    },
    adopt: (a3) => cliFlow(`Move ${a3.name} into the homelab`, "adopt", a3.id, "Move it"),
    open: (url) => go().Open(url),
    page: (a3) => pageOpener.open(a3.id),
    startAll: async (apps, progress2) => {
      for (const [i3, a3] of apps.entries()) {
        progress2(i3);
        setPending(a3.id, { action: "start" });
        try {
          await go().AppAction(a3.id, "start");
        } catch (err) {
          setPending(a3.id, { action: "start", failed: errorText(err) });
          break;
        }
      }
      await loadStatus();
      for (const a3 of apps) if (!pending[a3.id]?.failed) setPending(a3.id, null);
    }
  };
  var pageOpener = { open: (_id) => {
  } };
  var appActions = { act: (a3, action) => appListActions.act(a3, action), phone: showQR, signIn: showSignIn, update: showUpdate };
  var pendingOf = (id2) => pending[id2];
  var appsBusyNow = () => appsBusy;
  var rowWatchers = [];
  function watchRows(fn) {
    rowWatchers.push(fn);
  }
  var appList = null;
  var appsBusy = false;
  function setAppsBusy(busy) {
    appsBusy = busy;
    if (appList) mountAppList($2("statusRows"), appList = { ...appList, busy });
    rowWatchers.forEach((fn) => fn());
  }
  var pending = {};
  function setPending(id2, p3) {
    if (p3) pending[id2] = p3;
    else delete pending[id2];
    if (appList) mountAppList($2("statusRows"), appList = { ...appList, pending: { ...pending } });
    rowWatchers.forEach((fn) => fn());
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
    mountSheet($2("cliActions"), k(PhoneCode, { url, img, tailnet: /\.ts\.net(:|$)/.test(a3.address), phoneApp: catalog?.apps.find((c3) => c3.id === a3.id)?.phone, close: closeCli }));
    panel.scrollIntoView({ block: "nearest" });
  }
  function closeCli() {
    $2("cliPanel").hidden = true;
    $2("cliLog").hidden = false;
  }
  var cliButtons = (buttons) => mountSheet($2("cliActions"), k(Buttons, { buttons }));
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
    const rows = keys.map((k3) => {
      const s3 = byKey[k3] || {};
      const copy = s3.secret ? () => go().CopySetting(k3).then(() => "✓ Password copied; the clipboard clears in 90 seconds.", (e3) => {
        showError(e3);
        throw e3;
      }) : async () => {
        window.runtime.ClipboardSetText?.(s3.value || "");
        return `✓ ${label(k3)} copied.`;
      };
      return { label: label(k3), shown: s3.secret ? s3.set ? "••••••••" : "not set" : s3.value || "not set", copy: s3.set ? copy : void 0 };
    });
    mountSheet($2("cliActions"), k(SignIns, { rows, close: closeCli }));
    panel.scrollIntoView({ block: "nearest" });
  }
  var actionTitle = { start: "Starting", stop: "Stopping", restart: "Restarting", update: "Updating", rollback: "Rolling back" };
  async function runAppAction(a3, action) {
    const panel = $2("cliPanel"), log2 = $2("cliLog");
    log2.hidden = false;
    if (cliStop) cliStop();
    panel.hidden = false;
    $2("cliTitle").textContent = `${actionTitle[action]} ${a3.name}…`;
    log2.textContent = "";
    startJob("cli");
    cliButtons([]);
    setPending(a3.id, { action });
    setAppsBusy(true);
    panel.scrollIntoView({ block: "nearest" });
    const off = window.runtime.EventsOn("cli:log", (line) => {
      log2.textContent += line + "\n";
      log2.scrollTop = log2.scrollHeight;
    });
    let failed = "";
    try {
      await go().AppAction(a3.id, action);
    } catch (e3) {
      failed = errorText(e3);
      showError(e3);
    }
    if (failed) setPending(a3.id, { action, failed });
    setAppsBusy(false);
    if (typeof off === "function") off();
    cliProgress(failed ? "failed" : "done");
    $2("cliTitle").textContent = failed ? `${actionTitle[action]} ${a3.name} failed` : `${a3.name}: ${action} done`;
    cliButtons([{ label: "Close", onClick: () => {
      panel.hidden = true;
    } }]);
    await loadStatus();
    if (!failed) setPending(a3.id, null);
  }
  function showUpdate(a3) {
    const panel = $2("cliPanel");
    if (cliStop) cliStop();
    panel.hidden = false;
    $2("cliTitle").textContent = `Update ${a3.name}`;
    $2("cliLog").hidden = true;
    cliProgress(null);
    mountSheet($2("cliActions"), k(ReleaseNotes, {
      key: a3.id,
      name: a3.name,
      load: () => go().ReleaseNotes(a3.id),
      onUpdate: () => runAppAction(a3, "update"),
      onCancel: closeCli,
      open: (url) => go().Open(url)
    }));
    panel.scrollIntoView({ block: "nearest" });
  }
  mountSheets($2("sheets"), () => {
    if (missed) refreshStatus();
  });
  var cliStop = null;
  async function cliFlow(title, action, target, confirmLabel) {
    const panel = $2("cliPanel"), log2 = $2("cliLog");
    log2.hidden = false;
    if (cliStop) cliStop();
    panel.hidden = false;
    $2("cliTitle").textContent = title;
    log2.textContent = "";
    startJob("cli");
    cliButtons([]);
    const off = window.runtime.EventsOn("cli:log", (line) => {
      if (/^Preview only: nothing was changed/.test(line.trim())) return;
      log2.textContent += line + "\n";
      log2.scrollTop = log2.scrollHeight;
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
    cliButtons([
      { label: confirmLabel, primary: true, onClick: async () => {
        log2.textContent += "\n";
        cliButtons([]);
        let failed = false;
        try {
          await go().Homelab(action, target, true);
        } catch (err) {
          failed = true;
          showError(err);
        }
        cliProgress(failed ? "failed" : "done");
        stop();
        cliButtons([{ label: "Close", onClick: () => {
          panel.hidden = true;
        } }]);
        loadStatus();
      } },
      { label: "Cancel", onClick: () => {
        stop();
        panel.hidden = true;
      } }
    ]);
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
  var missed = false;
  function refreshStatus() {
    const behind = document.documentElement.classList.contains("sheet-open");
    missed = behind;
    if ($2("status").classList.contains("active") && !behind) loadStatus();
    else statusData.stale();
  }
  setInterval(refreshStatus, 6e4);
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
        const a3 = $2("reportDownload");
        a3.href = URL.createObjectURL(file);
        a3.download = file.name;
        a3.click();
        if (r3.helper) location.href = "mailto:" + encodeURIComponent(r3.helper) + "?subject=" + encodeURIComponent("Homelab report") + "&body=" + encodeURIComponent(text + " The file is attached.");
      }
    } catch (err) {
      if (err && err.name !== "AbortError") showError(err);
    }
    btn.disabled = false;
    btn.textContent = "Send a report";
  };

  // web/src/backups/Backups.tsx
  var tookText = (s3) => s3 < 120 ? `${s3} seconds` : `${Math.round(s3 / 60)} minutes`;
  var shortPath = (p3) => {
    const parts = p3.split("/").filter(Boolean);
    return parts.length > 2 ? "…/" + parts.slice(-2).join("/") : p3;
  };
  var order = { stale: 0, none: 1, paused: 2, fresh: 3 };
  var sortedCopies = (o3) => (o3.copies || []).slice().sort((a3, b2) => order[a3.state] - order[b2.state]);
  function placeName(dest) {
    const clouds = [[/ProtonDrive/i, "Proton Drive"], [/OneDrive/i, "OneDrive"], [/GoogleDrive|Google Drive/i, "Google Drive"], [/Dropbox/i, "Dropbox"], [/iCloud|Mobile Documents/i, "iCloud Drive"], [/pCloud/i, "pCloud"]];
    for (const [re, name] of clouds) if (re.test(dest)) return name;
    const drive = dest.match(/^\/(?:Volumes|media\/[^/]+|run\/media\/[^/]+|mnt)\/([^/]+)/) || dest.match(/^([A-Z]):[\\/]/i);
    if (drive) return `the ${drive[1]} drive`;
    return dest.split(/[\\/]/).filter(Boolean).pop() || dest;
  }
  var lastFolder = (p3) => p3.split(/[\\/]/).filter(Boolean).pop() || p3;
  var driveName = (path) => placeName(path);
  function sizeText(s3) {
    const m3 = s3.trim().match(/^([\d.,]+)\s*(bytes|B|KB|KiB|MB|MiB|GB|GiB|TB|TiB)$/i);
    if (!m3) return s3;
    const power = { b: 0, bytes: 0, kb: 1, kib: 1, mb: 2, mib: 2, gb: 3, gib: 3, tb: 4, tib: 4 }[m3[2].toLowerCase()];
    return bytes(parseFloat(m3[1].replace(",", ".")) * 1024 ** power);
  }
  function RestoreTile({ t: t3, due, test }) {
    const runs = t3.history || [];
    const newest = runs[runs.length - 1];
    const timed = runs.slice().reverse().find((r3) => r3.passed && r3.seconds);
    const sub = newest && !newest.passed ? /* @__PURE__ */ u3("span", { class: "bad", children: [
      "Failed ",
      ago(newest.when),
      ": ",
      newest.summary
    ] }) : due ? /* @__PURE__ */ u3("span", { class: "warn", children: "Prove the backups open, once a month" }) : (t3.lastSummary || "Proven in the last 30 days") + (timed ? ` · in ${tookText(timed.seconds)}` : "");
    const record2 = runs.slice(-6).reverse().map((r3) => `${new Date(r3.when).toLocaleDateString(void 0, { day: "numeric", month: "short" })}: ${r3.passed ? "passed" : "failed"}${r3.seconds ? " in " + tookText(r3.seconds) : ""}`);
    return /* @__PURE__ */ u3(
      Tile,
      {
        id: "restoreTile",
        title: record2.length ? `Restore drills on record (${runs.length}):
` + record2.join("\n") : void 0,
        label: "Restore test",
        value: never(t3.lastTest) ? "Never" : ago(t3.lastTest),
        sub: /* @__PURE__ */ u3(S, { children: [
          sub,
          test && /* @__PURE__ */ u3("span", { class: "tileaction", children: /* @__PURE__ */ u3("button", { id: "restoreTest", class: "small", title: "Duplicati restores a dozen files from last night's Homelab AppData backup, and each is compared with the live file", onClick: test, children: "Test a restore" }) })
        ] })
      }
    );
  }
  var drivesOf = (copies) => [...new Set(copies.map((c3) => driveName(c3.waitingFor || "")))].join(" and ");
  function BackupTiles({ o: o3, os, test }) {
    const copies = sortedCopies(o3);
    const fresh = copies.filter((c3) => c3.state === "fresh").length;
    const stale = copies.filter((c3) => c3.state === "stale");
    const paused = copies.filter((c3) => c3.state === "paused");
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(Tile, { label: "Last backup", value: never(o3.lastRun) ? "Never" : ago(o3.lastRun), sub: never(o3.envCopied) ? "Settings file not copied yet" : "Every night at 03:30; the settings file too" }),
      /* @__PURE__ */ u3(
        Tile,
        {
          id: "copiesTile",
          label: "Copies up to date",
          value: /* @__PURE__ */ u3(S, { children: [
            String(fresh),
            /* @__PURE__ */ u3("small", { children: [
              " of ",
              copies.length - paused.length
            ] })
          ] }),
          sub: stale.length || paused.length ? /* @__PURE__ */ u3(S, { children: [
            !!stale.length && /* @__PURE__ */ u3("span", { class: "bad", children: [
              "Stale: ",
              stale.map((c3) => c3.name).join(", ")
            ] }),
            !!paused.length && /* @__PURE__ */ u3("span", { children: `${paused.length} more paused: ${paused.length === 1 ? "its app waits" : "their apps wait"} for ${drivesOf(paused)}` })
          ] }) : `Each under ${o3.staleAfterHours} hours old`
        }
      ),
      /* @__PURE__ */ u3(
        Tile,
        {
          id: "offsiteTile",
          label: "Off-site",
          value: o3.destinationOK ? placeName(o3.destination) : /* @__PURE__ */ u3("span", { class: "warn", children: "Not set" }),
          sub: o3.destinationOK ? /* @__PURE__ */ u3("span", { title: o3.destination, children: [
            "Encrypted, in ",
            lastFolder(o3.destination)
          ] }) : os === "linux" ? "Put a backup drive or a synced folder in Settings › Backups go to" : "Put a Proton Drive folder in Settings › Backups go to"
        }
      ),
      /* @__PURE__ */ u3(RestoreTile, { t: o3.restoreTest || {}, due: o3.restoreDue, test })
    ] });
  }
  function copyGroups(o3) {
    const copies = sortedCopies(o3);
    const of = (state2) => copies.filter((c3) => c3.state === state2);
    const paused = of("paused"), none = of("none");
    const oldest = paused.filter((c3) => !never(c3.newest)).map((c3) => c3.newest).sort()[0];
    return [
      { key: "stale", label: "Stale", tone: "bad", copies: of("stale"), note: "" },
      { key: "fresh", label: "Up to date", tone: "ok", copies: of("fresh"), note: "" },
      {
        key: "paused",
        label: "Paused",
        tone: "",
        copies: paused,
        note: `${paused.map((c3) => c3.name).join(", ")} ${paused.length === 1 ? "waits" : "wait"} for ${drivesOf(paused)}` + (oldest ? `; ${paused.length === 1 ? "its last copy" : "their last copies"} (${ago(oldest)}) ${paused.length === 1 ? "is" : "are"} kept` : "")
      },
      { key: "none", label: "Not copied yet", tone: "", copies: none, note: `${none.map((c3) => c3.name).join(", ")}, tonight` }
    ].filter((g2) => g2.copies.length);
  }
  function CopyRows({ o: o3 }) {
    const [picked, setPicked] = d2({});
    const groups = copyGroups(o3);
    if (!groups.length) return /* @__PURE__ */ u3("tr", { children: /* @__PURE__ */ u3("td", { colSpan: 4, class: "muted", children: "No installed app has a database to dump yet." }) });
    return /* @__PURE__ */ u3(S, { children: groups.map((g2) => {
      const open = picked[g2.key] ?? (g2.key === "stale" || g2.key === "fresh");
      const toggle = () => setPicked({ ...picked, [g2.key]: !open });
      return [
        /* @__PURE__ */ u3("tr", { class: "grouphead fold copygroup " + g2.key + (g2.tone === "bad" ? " bad" : "") + (open ? " open" : ""), onClick: toggle, children: /* @__PURE__ */ u3("th", { colSpan: 4, children: [
          /* @__PURE__ */ u3("button", { type: "button", class: "foldbtn", "aria-expanded": open, onClick: (e3) => {
            e3.stopPropagation();
            toggle();
          }, children: [
            /* @__PURE__ */ u3("span", { class: "chev", "aria-hidden": "true", children: open ? "▾" : "▸" }),
            g2.label
          ] }),
          /* @__PURE__ */ u3("span", { class: "n", children: String(g2.copies.length) }),
          !open && g2.note && /* @__PURE__ */ u3("span", { class: "names", children: g2.note })
        ] }) }, "g:" + g2.key),
        ...open ? g2.copies.map((c3) => /* @__PURE__ */ u3("tr", { class: "copy " + c3.state, children: [
          /* @__PURE__ */ u3("td", { class: "name", children: [
            /* @__PURE__ */ u3("span", { class: "dot " + g2.tone }),
            c3.name
          ] }),
          /* @__PURE__ */ u3("td", { class: "when muted", children: never(c3.newest) ? "—" : ago(c3.newest) }),
          /* @__PURE__ */ u3("td", { class: "size muted", children: bytes(c3.size) }),
          /* @__PURE__ */ u3("td", { class: "kept muted", children: c3.count ? `${c3.count} kept` : "—" })
        ] }, c3.id)) : []
      ];
    }) });
  }
  function Vault({ o: o3 }) {
    const plain = o3.plainExports || [];
    const [tone, said] = plain.length ? ["bad", "A plain export is lying in recovery-staging/secrets: delete it"] : never(o3.vaultExport) ? ["warn", "Never made yet"] : o3.vaultDue ? ["warn", `Due: the last one is from ${ago(o3.vaultExport)}`] : ["ok", `The last one ${ago(o3.vaultExport)}`];
    return /* @__PURE__ */ u3("details", { class: "morerow", open: !!plain.length, children: [
      /* @__PURE__ */ u3("summary", { children: [
        /* @__PURE__ */ u3("span", { class: "dot " + tone }),
        /* @__PURE__ */ u3("span", { class: "grow", children: [
          /* @__PURE__ */ u3("strong", { children: "Password vault export" }),
          /* @__PURE__ */ u3("span", { class: "sub " + (tone === "bad" ? "bad" : "muted"), children: [
            "A copy of your passwords you can open anywhere, once a month. ",
            said,
            "."
          ] })
        ] }),
        /* @__PURE__ */ u3("span", { class: "btn small", children: "How" })
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
  function jobsProblem(problem, waitingFor) {
    if (/DUPLICATI_PASSWORD is empty/.test(problem)) return "Shown here once DUPLICATI_PASSWORD is in Settings.";
    if (waitingFor) return `Duplicati waits for ${driveName(waitingFor)}: the jobs show here once it is plugged in.`;
    if (/connection refused|dial tcp|no such host|timeout|EOF/i.test(problem)) return "Duplicati is not answering: start it on Status, and the jobs show here.";
    return problem;
  }
  function Jobs({ jobs, place, problem, waitingFor, create }) {
    const title = place ? `Encrypted to ${place}` : "Encrypted off-site";
    if (!jobs) {
      return /* @__PURE__ */ u3(CardHead, { title, children: /* @__PURE__ */ u3("span", { class: "muted", title: problem, children: jobsProblem(problem || "", waitingFor) }) });
    }
    if (!jobs.length) {
      return /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3(CardHead, { title, children: /* @__PURE__ */ u3("button", { class: "small", onClick: create, children: "Create the backup jobs" }) }),
        /* @__PURE__ */ u3("p", { class: "muted", children: "No jobs yet. This makes the jobs in docs/Automation.md, encrypted with passphrases kept in .env, and runs the small ones once. Then copy DUPLICATI_SECRETS_PASSPHRASE from Settings into Vaultwarden." })
      ] });
    }
    const bad = jobs.filter((j3) => j3.state !== "ok").length;
    const newest = jobs.map((j3) => j3.lastFinished).filter((t3) => !never(t3)).sort().pop();
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title, children: bad ? /* @__PURE__ */ u3("span", { class: "warn", children: [
        bad,
        " need a look"
      ] }) : /* @__PURE__ */ u3("span", { class: "ok", children: [
        "✓ All ",
        jobs.length,
        " ran",
        newest ? " " + ago(newest) : ""
      ] }) }),
      /* @__PURE__ */ u3(Rows, { kind: "jobs", children: jobs.map((j3) => {
        const [tone, word] = jobMark[j3.state] || ["", j3.state];
        return /* @__PURE__ */ u3(
          Row,
          {
            dot: tone,
            title: j3.name,
            sub: j3.errorMessage || j3.state !== "ok" && word,
            subTone: j3.errorMessage ? "bad" : void 0,
            end: j3.size && /* @__PURE__ */ u3("span", { class: "size muted", children: sizeText(j3.size) }),
            whenTitle: (never(j3.lastFinished) ? "Never ran" : "Last ran " + new Date(j3.lastFinished).toLocaleString()) + (never(j3.nextRun) ? "" : "\nNext run " + new Date(j3.nextRun).toLocaleString()),
            when: never(j3.nextRun) ? never(j3.lastFinished) ? "never ran" : "ran " + ago(j3.lastFinished) : /* @__PURE__ */ u3("span", { class: "next", children: [
              "next ",
              untilText(j3.nextRun)
            ] })
          },
          j3.id
        );
      }) })
    ] });
  }
  function KopiaLine({ k: k3, test }) {
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: "Second copy (Kopia)", children: k3.failed ? /* @__PURE__ */ u3("span", { class: "bad", children: "✗ Restore test failed" }) : k3.due ? /* @__PURE__ */ u3("span", { class: "warn", children: "Due: Test Kopia's restore" }) : /* @__PURE__ */ u3("span", { class: "ok", children: [
        "✓ Restore proven ",
        ago(k3.lastTest)
      ] }) }),
      /* @__PURE__ */ u3("p", { class: "muted", children: [
        "Kopia keeps a copy of its own of the same folders in ",
        /* @__PURE__ */ u3("span", { title: k3.repository, children: shortPath(k3.repository) }),
        ", apart from Duplicati's, and its restore is tested on its own.",
        " ",
        k3.failed ? `The last test: ${k3.failed}.` : never(k3.lastTest) ? "No restore test yet." : `Last proven ${ago(k3.lastTest)}.`
      ] }),
      /* @__PURE__ */ u3("div", { class: "actions", children: /* @__PURE__ */ u3("button", { class: "btn", onClick: test, children: "Test Kopia's restore" }) })
    ] });
  }
  var mountKopia = (el, props) => R(props && /* @__PURE__ */ u3(KopiaLine, { ...props }), el);
  var mountBackupTiles = (el, props) => R(/* @__PURE__ */ u3(BackupTiles, { ...props }), el);
  var mountCopyRows = (el, props) => R(props && /* @__PURE__ */ u3(CopyRows, { ...props }), el);
  var mountVault = (el, props) => R(/* @__PURE__ */ u3(Vault, { ...props }), el);
  var mountJobs = (el, props) => R(/* @__PURE__ */ u3(Jobs, { ...props }), el);

  // web/src/screens/backups.ts
  var backupsData = store(() => go().Backups());
  var jobsData = store(async () => await go().DuplicatiJobs() || []);
  backupsData.watch(() => {
    drawBackups();
    drawJobs();
  });
  jobsData.watch(() => {
    if (backupsData.value && !backupsData.error) drawBackups();
    drawJobs();
  });
  function loadBackups() {
    return Promise.all([jobsData.load(), backupsData.load()]);
  }
  function drawBackups() {
    if (backupsData.error) {
      mountCopyRows($2("backupRows"), null);
      showError(backupsData.error);
      return;
    }
    const o3 = backupsData.value;
    const testable2 = (jobsData.value || []).some((j3) => j3.name.toLowerCase() === "homelab appdata" && j3.state !== "never");
    const test = () => backupTask("restore-test", "Testing a restore (a few minutes)…", "Restore test passed", "The restore test failed: the log says why");
    mountBackupTiles($2("backupTiles"), { o: o3, os: osName, test: testable2 ? test : void 0 });
    mountCopyRows($2("backupRows"), { o: o3 });
    mountVault($2("vaultCard"), { o: o3 });
    $2("kopiaCard").hidden = !o3.kopia;
    mountKopia($2("kopiaCard"), o3.kopia ? { k: o3.kopia, test: () => backupTask("restore-test-kopia", "Testing Kopia's restore (a few minutes)…", "Kopia's restore test passed", "Kopia's restore test failed: the log says why") } : null);
    const problems = (o3.copies || []).filter((c3) => c3.state === "stale").length + (o3.plainExports || []).length + (o3.kopia?.failed ? 1 : 0);
    $2("backupsCount").textContent = problems ? String(problems) : "";
    const dup = statusById.duplicati;
    $2("openDuplicati").hidden = !(dup?.state === "running" && dup.url);
    $2("openDuplicati").onclick = () => go().Open(dup.url);
  }
  function drawJobs() {
    const card = $2("dupCard");
    const create = () => backupTask("duplicati-setup", "Creating the backup jobs…", "Backup jobs created", "Creating the jobs stopped: the log says why");
    if (!jobsData.value && !jobsData.error) return;
    const o3 = backupsData.value;
    const place = o3?.destinationOK ? placeName(o3.destination) : "";
    if (jobsData.error) {
      const e3 = jobsData.error;
      mountJobs(card, { jobs: null, place, problem: String(e3 && e3.message || e3), waitingFor: statusById.duplicati?.waitingFor, create });
      return;
    }
    mountJobs(card, { jobs: jobsData.value, place, create });
  }
  async function backupTask(action, busy, done, failed) {
    const panel = $2("backupPanel"), log2 = $2("backupLog");
    const btns = () => [$2("backupNow"), document.getElementById("restoreTest")].filter(Boolean);
    panel.hidden = false;
    $2("backupTitle").textContent = busy;
    log2.textContent = "";
    startJob("backup");
    btns().forEach((b2) => {
      b2.disabled = true;
    });
    const off = window.runtime.EventsOn("cli:log", (line) => {
      log2.textContent += line + "\n";
      log2.scrollTop = log2.scrollHeight;
    });
    let ok = true;
    try {
      await go().Homelab(action, "", action === "backup");
    } catch (e3) {
      ok = false;
      showError(e3);
    }
    cliProgress(ok ? "done" : "failed");
    endJob();
    if (typeof off === "function") off();
    $2("backupTitle").textContent = ok ? done : failed;
    btns().forEach((b2) => {
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
    const panel = $2("backupPanel"), log2 = $2("backupLog");
    button.disabled = true;
    panel.hidden = false;
    $2("backupTitle").textContent = direction === "out" ? "Moving out (a backup first, then packing)…" : "Moving in…";
    log2.textContent = "";
    const off = window.runtime.EventsOn("cli:log", (line) => {
      log2.textContent += line + "\n";
      log2.scrollTop = log2.scrollHeight;
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

  // web/src/page/AppPage.tsx
  var doing2 = { start: "Starting…", stop: "Stopping…", restart: "Restarting…", update: "Updating…", rollback: "Rolling back…" };
  function uptime(since) {
    if (!since) return "";
    const mins = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 6e4)), hours = Math.round(mins / 60);
    return mins < 60 ? mins <= 1 ? "up a minute" : `up ${mins} minutes` : hours < 48 ? hours === 1 ? "up an hour" : `up ${hours} hours` : `up ${Math.round(hours / 24)} days`;
  }
  function memory(mem) {
    const m3 = /^([\d.]+)\s*([KMGT]?)i?B$/i.exec(mem.trim());
    if (!m3) return mem;
    return bytes(Number(m3[1]) * 1024 ** " KMGT".indexOf((m3[2] || " ").toUpperCase()));
  }
  function when(t3, now = /* @__PURE__ */ new Date()) {
    const d3 = new Date(t3);
    const clock = d3.toLocaleTimeString(void 0, { hour: "numeric", minute: "2-digit" });
    const day3 = (x2) => new Date(x2.getFullYear(), x2.getMonth(), x2.getDate()).getTime();
    const days = Math.round((day3(now) - day3(d3)) / 864e5);
    if (days === 0) return `Today, ${clock}`;
    if (days === 1) return `Yesterday, ${clock}`;
    return d3.toLocaleDateString(void 0, { weekday: "short", day: "numeric", month: "short" });
  }
  var dayTone = (d3) => !d3.all ? "" : d3.ok === d3.all ? "ok" : d3.ok ? "warn" : "bad";
  function weekShare(days) {
    const ok = days.reduce((n2, d3) => n2 + d3.ok, 0), all = days.reduce((n2, d3) => n2 + d3.all, 0);
    return all ? ok / all : 1;
  }
  function weekWords(days) {
    const ok = days.reduce((n2, d3) => n2 + d3.ok, 0), all = days.reduce((n2, d3) => n2 + d3.all, 0);
    if (!all) return ["Not checked yet", "The watchdog checks it every 15 minutes once Setup turns it on"];
    const missed2 = days.filter((d3) => d3.all && d3.ok < d3.all);
    if (!missed2.length) return ["Up all week", "Every check passed, every 15 minutes"];
    const share2 = Math.floor(ok / all * 1e3) / 10;
    return [`Up ${share2}%`, `Missed checks on ${missed2.map((d3) => d3.weekday).join(", ")}`];
  }
  function Week2({ days }) {
    const [, line] = weekWords(days);
    const said = days.map((d3) => `${d3.name}: ${!d3.all ? "not checked" : d3.ok === d3.all ? "up" : `${d3.ok} of ${d3.all} checks passed`}`).join("; ");
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("div", { class: "weekbars", role: "img", "aria-label": said, children: days.map((d3) => /* @__PURE__ */ u3("span", { class: "day" + (d3.today ? " today" : ""), title: said.split("; ")[days.indexOf(d3)], children: [
        /* @__PURE__ */ u3("span", { class: "bar " + dayTone(d3) }),
        d3.letter
      ] }, d3.name)) }),
      /* @__PURE__ */ u3("span", { children: line })
    ] });
  }
  function LogLines({ text }) {
    const lines = text.replace(/\s+$/, "").split("\n");
    return /* @__PURE__ */ u3("pre", { class: "applog selectable", role: "log", tabIndex: 0, "aria-label": "Its log", children: lines.map((l3, i3) => {
      const tone = /\b(ERROR|FATAL|PANIC|CRIT(ICAL)?)\b|level=(error|fatal)/i.test(l3) ? "bad" : /\bWARN(ING)?\b|level=warn/i.test(l3) ? "warn" : "";
      return /* @__PURE__ */ u3("span", { class: tone ? "line " + tone : "line", children: l3 + "\n" }, i3);
    }) });
  }
  function Log({ explainer: explainer2, machine, dozzle, on }) {
    const [lines, setLines] = d2(200);
    const [text, setText] = d2(null);
    const [answer, setAnswer] = d2("");
    const [asking, setAsking] = d2(false);
    const [problem, setProblem] = d2("");
    const read = (n2) => {
      setLines(n2);
      on.logs(n2).then((t3) => setText(t3.trim() ? t3 : "(the log is empty)"), (e3) => setText(String(e3?.message || e3)));
    };
    h2(() => {
      read(200);
    }, []);
    const ask = async () => {
      setAsking(true);
      setProblem("");
      try {
        setAnswer(await on.explain());
      } catch (e3) {
        setProblem(String(e3?.message || e3));
      } finally {
        setAsking(false);
      }
    };
    return /* @__PURE__ */ u3(Card, { kind: "alerts pagecard", id: "appLog", children: [
      /* @__PURE__ */ u3(CardHead, { title: "Log", children: /* @__PURE__ */ u3("span", { class: "actions", children: [
        lines < 2e3 && /* @__PURE__ */ u3(ActionLink, { onClick: () => read(2e3), children: "Show more of it" }),
        dozzle && /* @__PURE__ */ u3(ActionLink, { title: "Follow every log live in Dozzle", onClick: () => on.open(dozzle), children: "Dozzle" }),
        /* @__PURE__ */ u3("button", { class: "iconbtn", title: "Read it again", "aria-label": "Read it again", onClick: () => read(lines), children: /* @__PURE__ */ u3(Icon, { name: "restart" }) }),
        explainer2 && /* @__PURE__ */ u3("button", { class: "small tint", disabled: asking, onClick: ask, children: asking ? "Reading the log…" : "Explain this" })
      ] }) }),
      text === null ? /* @__PURE__ */ u3("p", { class: "muted", children: "Reading its log…" }) : /* @__PURE__ */ u3(LogLines, { text }),
      (answer || problem) && !asking && /* @__PURE__ */ u3("div", { class: "explained", role: "status", children: [
        answer && /* @__PURE__ */ u3("p", { class: "answer", children: answer }),
        problem && /* @__PURE__ */ u3("p", { class: "muted", children: problem }),
        /* @__PURE__ */ u3("div", { class: "row", children: [
          /* @__PURE__ */ u3("span", { class: "muted", children: [
            /* @__PURE__ */ u3(Icon, { name: "lock" }),
            " Explained on ",
            machine,
            " by ",
            explainer2.replace(/:latest$/, ""),
            "; the log never left it"
          ] }),
          /* @__PURE__ */ u3("span", { class: "actions", children: [
            /* @__PURE__ */ u3(ActionLink, { onClick: ask, children: "Ask again" }),
            /* @__PURE__ */ u3(ActionLink, { onClick: () => {
              setAnswer("");
              setProblem("");
            }, children: "Hide" })
          ] })
        ] })
      ] })
    ] });
  }
  function CopyButton({ text, copy }) {
    const [said, setSaid] = d2("");
    return /* @__PURE__ */ u3("button", { class: "small", onClick: () => copy(text).then((s3) => {
      setSaid(s3);
      setTimeout(() => setSaid(""), 2500);
    }, () => {
    }), children: said ? /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(Icon, { name: "check" }),
      "Copied"
    ] }) : "Copy" });
  }
  function AppMark({ name, icon }) {
    const [broken, setBroken] = d2("");
    const [drawn, setDrawn] = d2({ of: "", size: "" });
    if (!icon || broken === icon) return /* @__PURE__ */ u3("span", { class: "appmark", "aria-hidden": "true", children: name.slice(0, 1) });
    const picture = /^data:image\/(png|jpeg|webp)/.test(icon), size = drawn.of === icon ? drawn.size : "";
    const measure = (w3) => setDrawn({ of: icon, size: w3 > 0 && w3 <= 24 && !icon.startsWith("data:image/svg") ? "small" : picture && w3 >= 120 ? "fill" : "" });
    return /* @__PURE__ */ u3("span", { class: "appmark icon" + (size === "fill" ? " fill" : ""), "aria-hidden": "true", children: /* @__PURE__ */ u3(
      "img",
      {
        src: icon,
        alt: "",
        class: size === "small" ? "small" : "",
        onError: () => setBroken(icon),
        onLoad: (e3) => measure(e3.currentTarget.naturalWidth)
      }
    ) });
  }
  function Header({ p: p3 }) {
    const { a: a3, entry, pending: pending2, busy, on } = p3;
    const [tone, words] = pending2 && !pending2.failed ? ["warn", doing2[pending2.action] || "Working…"] : p3.state;
    const up = a3.state === "running" && !pending2 ? uptime(a3.since) : "";
    const url = a3.address ? "https://" + a3.address : a3.url || "";
    const run = (action, label, title, danger = false) => /* @__PURE__ */ u3("button", { class: "btn change" + (danger ? " danger" : ""), title, disabled: busy, onClick: () => on.act(action), children: label });
    const container = entry?.kind !== "native" && a3.state !== "missing" && a3.state !== "elsewhere";
    return /* @__PURE__ */ u3("div", { class: "pagehead", children: [
      /* @__PURE__ */ u3("div", { class: "who", children: [
        /* @__PURE__ */ u3(AppMark, { name: a3.name, icon: p3.icon }),
        /* @__PURE__ */ u3("div", { children: [
          /* @__PURE__ */ u3("div", { class: "titlerow", children: [
            /* @__PURE__ */ u3("h1", { children: a3.name }),
            /* @__PURE__ */ u3("span", { class: "pill " + tone, children: [
              /* @__PURE__ */ u3("span", { class: "dot " + tone }),
              words,
              up && ` · ${up}`
            ] })
          ] }),
          entry?.description && /* @__PURE__ */ u3("p", { class: "lead", children: entry.description }),
          pending2?.failed && /* @__PURE__ */ u3("p", { class: "rowerr", role: "status", children: [
            "Could not ",
            pending2.action === "rollback" ? "roll back" : pending2.action,
            ": ",
            pending2.failed
          ] })
        ] })
      ] }),
      /* @__PURE__ */ u3("div", { class: "toolbar", children: [
        container && (a3.state === "running" ? /* @__PURE__ */ u3("span", { class: "btngroup", role: "group", "aria-label": "Run", children: [
          run("restart", "Restart", "Restart it"),
          run("stop", "Stop", "Stop it; its data is kept")
        ] }) : run("start", "Start", "Start it")),
        a3.state === "running" && a3.address && !p3.companion && /* @__PURE__ */ u3("button", { class: "btn", disabled: busy, onClick: on.phone, children: [
          /* @__PURE__ */ u3(Icon, { name: "phone" }),
          "Open on a phone"
        ] }),
        a3.state === "running" && url && /* @__PURE__ */ u3("button", { class: "primary small", onClick: () => on.open(url), children: "Open" })
      ] })
    ] });
  }
  function Facts({ p: p3 }) {
    const { a: a3, entry, usage: usage2, disk: disk2, days, backup: o3, on } = p3;
    const url = a3.address ? "https://" + a3.address : a3.url || "";
    const reach = entry?.public ? "At home, and on the internet through the Cloudflare Tunnel" : a3.address ? "At home and on your tailnet, not on the internet" : "On this machine only";
    const [weekValue] = weekWords(days);
    const late = o3 && !never(o3.lastRun) && Date.now() - new Date(o3.lastRun).getTime() > (o3.staleAfterHours || 30) * 36e5;
    const tested = o3 && !never(o3.restoreTest?.lastTest) ? `Restore test passed ${new Date(o3.restoreTest.lastTest).toLocaleDateString(void 0, { day: "numeric", month: "short" })}` : "No restore test yet";
    return /* @__PURE__ */ u3("div", { class: "tiles facts", children: [
      /* @__PURE__ */ u3(
        Tile,
        {
          label: "Address",
          value: url ? /* @__PURE__ */ u3("a", { href: url, onClick: (e3) => {
            e3.preventDefault();
            on.open(url);
          }, children: url.replace(/^https?:\/\//, "") }) : /* @__PURE__ */ u3("span", { class: "muted", children: "None" }),
          sub: /* @__PURE__ */ u3(S, { children: [
            url ? reach : "It has no web page",
            url && /* @__PURE__ */ u3(CopyButton, { text: url, copy: on.copy })
          ] })
        }
      ),
      /* @__PURE__ */ u3(
        Tile,
        {
          label: "Uses now",
          value: a3.state !== "running" ? /* @__PURE__ */ u3("span", { class: "muted", children: "Nothing" }) : usage2 ? /* @__PURE__ */ u3(S, { children: [
            memory(usage2.mem),
            /* @__PURE__ */ u3("small", { children: " of memory" })
          ] }) : /* @__PURE__ */ u3("span", { class: "muted", children: usage2 === null ? "Not measured" : "…" }),
          sub: a3.state !== "running" ? "It is not running" : /* @__PURE__ */ u3(S, { children: [
            usage2 ? `${usage2.cpu < 10 ? usage2.cpu.toFixed(1) : Math.round(usage2.cpu)}% of a processor` : usage2 === null ? "The container runtime did not say" : "Reading what it uses…",
            !!disk2 && /* @__PURE__ */ u3("span", { children: [
              "· ",
              bytes(disk2),
              " on disk"
            ] })
          ] })
        }
      ),
      /* @__PURE__ */ u3(Tile, { label: "This week", value: weekValue, tone: weekShare(days) < 0.99 ? "warn" : "", sub: /* @__PURE__ */ u3(Week2, { days }) }),
      /* @__PURE__ */ u3(
        Tile,
        {
          label: "Last backup",
          tone: late ? "warn" : "",
          value: !o3 ? /* @__PURE__ */ u3("span", { class: "muted", children: "…" }) : never(o3.lastRun) ? /* @__PURE__ */ u3("span", { class: "muted", children: "Not yet" }) : /* @__PURE__ */ u3(S, { children: [
            when(o3.lastRun),
            !late && /* @__PURE__ */ u3("span", { class: "ok", children: [
              " ",
              /* @__PURE__ */ u3(Icon, { name: "check" })
            ] })
          ] }),
          sub: /* @__PURE__ */ u3(S, { children: [
            o3 ? tested : "",
            /* @__PURE__ */ u3(ActionLink, { onClick: on.openBackups, children: "Backups ›" })
          ] })
        }
      )
    ] });
  }
  function Updates({ p: p3 }) {
    const { a: a3, busy, on } = p3;
    const rows = [];
    if (a3.updatedAt) {
      rows.push(/* @__PURE__ */ u3(
        Row,
        {
          dot: "ok",
          title: "The version it runs now",
          sub: `Updated ${ago(a3.updatedAt)}; the one before is kept for a week`,
          end: /* @__PURE__ */ u3("button", { class: "small change", disabled: busy, title: "Go back to the version it ran before, and hold its updates", onClick: () => on.act("rollback"), children: "Roll back" })
        },
        "now"
      ));
    }
    if (a3.held) rows.push(/* @__PURE__ */ u3(Row, { dot: "warn", title: "Its updates are held", sub: `After a rollback, the nightly update leaves it out; homelab updates release ${a3.id} puts it back` }, "held"));
    return /* @__PURE__ */ u3(Card, { kind: "alerts pagecard", id: "appUpdates", children: [
      /* @__PURE__ */ u3(CardHead, { title: "Updates", children: a3.state === "running" && /* @__PURE__ */ u3("button", { class: "small change", disabled: busy, title: "Shows what it brings first: its newer releases' notes", onClick: on.update, children: "Check for an update" }) }),
      rows.length ? /* @__PURE__ */ u3(Rows, { children: rows }) : /* @__PURE__ */ u3(Empty, { children: "No update since the homelab last started it. The nightly update dumps its database first, then updates it." })
    ] });
  }
  function People2({ p: p3 }) {
    const { entry, people, on } = p3;
    if (!people && !entry?.login?.length) return null;
    return /* @__PURE__ */ u3(Card, { kind: "alerts pagecard", id: "appPeople", children: [
      /* @__PURE__ */ u3(CardHead, { title: people ? "Who uses it" : "Signing in", children: !!entry?.login?.length && /* @__PURE__ */ u3("button", { class: "small", onClick: () => on.signIn(entry.login), children: [
        /* @__PURE__ */ u3(Icon, { name: "key" }),
        "Sign-in details"
      ] }) }),
      people && (people.length ? /* @__PURE__ */ u3(Rows, { children: people.map((x2) => /* @__PURE__ */ u3(Row, { title: /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("span", { class: "initial", "aria-hidden": "true", children: (x2.name || x2.username).slice(0, 1) }),
        x2.name || x2.username
      ] }), sub: x2.email }, x2.username)) }) : /* @__PURE__ */ u3(Empty, { children: "Nobody in the household uses it yet." })),
      people && /* @__PURE__ */ u3("p", { class: "muted foot", children: /* @__PURE__ */ u3(ActionLink, { onClick: on.openPeople, children: "Add someone in Settings › People" }) })
    ] });
  }
  function Switch({ label, sub, on, disabled, set: set2 }) {
    return /* @__PURE__ */ u3(
      Row,
      {
        title: label,
        sub,
        end: /* @__PURE__ */ u3(S, { children: [
          /* @__PURE__ */ u3("input", { type: "checkbox", class: "switch change", role: "switch", "aria-label": label, checked: on, disabled, onChange: (e3) => set2(e3.currentTarget.checked) }),
          /* @__PURE__ */ u3("span", { class: "switchstate muted", children: on ? "On" : "Off" })
        ] })
      }
    );
  }
  function Settings({ p: p3 }) {
    const { a: a3, entry, busy, backup: o3, switching: switching2, on } = p3;
    const container = entry?.kind !== "native" && a3.state !== "missing" && a3.state !== "elsewhere";
    const updates = switching2.updates ?? !a3.held, alerts = switching2.alerts ?? !a3.quiet;
    const ids = [a3.id, ...entry?.dependsOn || []];
    const copy = o3?.copies?.find((c3) => ids.includes(c3.id) && !c3.volume && !never(c3.newest));
    const kept = container ? copy ? `Its files, and its database's copy from ${when(copy.newest)}` : "Its files in the homelab folder, every night" : "It runs on its own, outside the homelab; its own app keeps its data";
    return /* @__PURE__ */ u3(Card, { kind: "alerts pagecard", id: "appSettings", children: [
      /* @__PURE__ */ u3(CardHead, { title: "Settings", children: null }),
      /* @__PURE__ */ u3(Rows, { children: [
        container && /* @__PURE__ */ u3(
          Switch,
          {
            label: "Nightly updates",
            disabled: busy || "updates" in switching2 || updates && a3.state !== "running",
            on: updates,
            set: (v3) => on.setting("updates", v3),
            sub: updates ? a3.state === "running" ? "Every night, with a backup of its data first" : "Every night while it runs; start it to hold its updates" : "Held: the nightly update leaves it out"
          }
        ),
        /* @__PURE__ */ u3(
          Switch,
          {
            label: "Tell me if it stops",
            disabled: busy || "alerts" in switching2,
            on: alerts,
            set: (v3) => on.setting("alerts", v3),
            sub: alerts ? `On your phone through ntfy, and on ${p3.machine}` : "Still checked and shown on Status, without an alert"
          }
        ),
        /* @__PURE__ */ u3(Row, { title: "In the nightly backup", sub: kept, end: /* @__PURE__ */ u3(ActionLink, { onClick: on.openBackups, children: "Backups ›" }) })
      ] })
    ] });
  }
  function More({ p: p3 }) {
    const container = p3.entry?.kind !== "native" && p3.a.state !== "missing" && p3.a.state !== "elsewhere";
    return /* @__PURE__ */ u3(Card, { kind: "alerts pagecard", id: "appMore", children: [
      /* @__PURE__ */ u3(CardHead, { title: "More", children: null }),
      /* @__PURE__ */ u3("div", { class: "actions", children: [
        /* @__PURE__ */ u3("button", { class: "small change", disabled: p3.busy, title: "Dumps every database and copies the settings now, as the nightly backup does", onClick: p3.on.backupNow, children: "Back up now" }),
        /* @__PURE__ */ u3("button", { class: "small", onClick: p3.on.openBackups, children: "Open Backups" })
      ] }),
      container && !p3.companion && /* @__PURE__ */ u3("div", { class: "remove", children: [
        /* @__PURE__ */ u3("button", { class: "small danger change", disabled: p3.busy, title: "Backs it up first; its container goes, its data stays in the homelab folder", onClick: p3.on.remove, children: [
          "Remove ",
          p3.a.name,
          "…"
        ] }),
        /* @__PURE__ */ u3("span", { class: "muted", children: "A backup first; its data stays, so Choose stacks can bring it back." })
      ] })
    ] });
  }
  function AppPage(p3) {
    return /* @__PURE__ */ u3("div", { class: "apppage", children: [
      /* @__PURE__ */ u3(ActionLink, { cls: "back", onClick: p3.on.back, children: "‹ Status" }),
      /* @__PURE__ */ u3(Header, { p: p3 }),
      /* @__PURE__ */ u3(Facts, { p: p3 }),
      /* @__PURE__ */ u3("div", { class: "pagecols", children: [
        /* @__PURE__ */ u3("div", { class: "pagecol", children: [
          p3.entry?.kind !== "native" && p3.a.state !== "missing" && p3.a.state !== "elsewhere" && /* @__PURE__ */ u3(Log, { explainer: p3.explainer, machine: p3.machine, dozzle: p3.dozzle, on: p3.on }),
          /* @__PURE__ */ u3(Updates, { p: p3 })
        ] }),
        /* @__PURE__ */ u3("div", { class: "pagecol", children: [
          /* @__PURE__ */ u3(Settings, { p: p3 }),
          /* @__PURE__ */ u3(People2, { p: p3 }),
          /* @__PURE__ */ u3(More, { p: p3 })
        ] })
      ] })
    ] });
  }
  function mountAppPage(el, props) {
    R(props ? /* @__PURE__ */ u3(AppPage, { ...props }, props.a.id) : null, el);
  }

  // web/src/screens/apppage.ts
  var id = "";
  var usage;
  var disk;
  var watch = null;
  var household = null;
  var explainer = "";
  var switching = {};
  async function setSetting(appId, setting, on) {
    switching[appId] = { ...switching[appId], [setting]: on };
    draw2();
    try {
      await go().SetAppSetting(appId, setting, on);
    } catch (e3) {
      showError(e3);
    }
    await statusData.load().catch(() => {
    });
    const { [setting]: _3, ...rest } = switching[appId] || {};
    switching[appId] = rest;
    draw2();
  }
  var icons2 = {};
  var shown2 = () => !!id && $2("app").classList.contains("active");
  function openApp(appId) {
    if (appId !== id) {
      usage = void 0;
      disk = void 0;
      household = null;
    }
    id = appId;
    navigate("app");
    const h1 = $1("#app h1");
    if (h1) {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    }
    $2("app").scrollIntoView?.({ block: "start" });
  }
  pageOpener.open = openApp;
  function refreshApp() {
    if (!id) return show("status");
    draw2();
    readIcon(id);
    readUsage();
    readRest();
    backupsData.fresh(minute);
  }
  function week() {
    const runs = watch?.days?.[id] || {};
    const out = [];
    for (let i3 = 6; i3 >= 0; i3--) {
      const d3 = /* @__PURE__ */ new Date();
      d3.setDate(d3.getDate() - i3);
      const key2 = `${d3.getFullYear()}-${String(d3.getMonth() + 1).padStart(2, "0")}-${String(d3.getDate()).padStart(2, "0")}`;
      const [ok, all] = runs[key2] || [0, 0];
      out.push({ letter: d3.toLocaleDateString(void 0, { weekday: "narrow" }), name: d3.toLocaleDateString(void 0, { weekday: "long", day: "numeric", month: "short" }), weekday: d3.toLocaleDateString(void 0, { weekday: "long" }), ok, all, today: i3 === 0 });
    }
    return out;
  }
  async function readUsage() {
    const at = id;
    let stats = [];
    try {
      stats = await go().Usage() || [];
    } catch {
    }
    if (at !== id) return;
    usage = stats.find((s3) => s3.name === id) || null;
    draw2();
  }
  setInterval(() => {
    if (!document.hidden && shown2()) readUsage();
  }, 1e4);
  async function readIcon(of) {
    let icon = "";
    try {
      icon = await go().AppIcon(of) || "";
    } catch {
    }
    if (icon === (icons2[of] || "")) return;
    icons2[of] = icon;
    if (of === id) draw2();
  }
  async function readRest() {
    const at = id;
    const [w3, st, ppl, ex] = await Promise.allSettled([go().Watchdog(), go().Storage(), go().People(), go().Explainer()]);
    if (at !== id) return;
    watch = w3.status === "fulfilled" ? w3.value : null;
    disk = st.status === "fulfilled" ? st.value?.apps?.find((x2) => x2.app === id)?.bytes : void 0;
    household = ppl.status === "fulfilled" ? (ppl.value || []).filter((p3) => never2(p3.removed) && (!p3.apps?.length || p3.apps.includes(id))) : null;
    explainer = ex.status === "fulfilled" ? ex.value || "" : "";
    draw2();
  }
  var never2 = (t3) => !t3 || t3.startsWith("0001-");
  function draw2() {
    if (!id) return;
    const a3 = statusById[id];
    if (!a3) {
      if (shown2() && statusData.value) {
        mountAppPage($2("appPage"), null);
        show("status");
      }
      return;
    }
    const entry = catalog?.apps.find((c3) => c3.id === id);
    const companion2 = document.documentElement.classList.contains("companion");
    mountAppPage($2("appPage"), {
      a: a3,
      entry,
      state: stateOf(a3, new Set(statusData.value?.batteryPaused || [])),
      pending: pendingOf(id),
      busy: appsBusyNow(),
      usage: a3.state === "running" ? usage : void 0,
      disk,
      days: week(),
      switching: switching[id] || {},
      backup: backupsData.value || null,
      people: usedByPeople(a3, entry) && household ? household : null,
      icon: icons2[id] || "",
      explainer,
      // Dozzle is kept to this computer (docs/Security.md, L1): not on a phone.
      dozzle: !companion2 && statusById.dozzle?.state === "running" ? statusById.dozzle.url || "" : "",
      machine: thisMachine.replace(/^This/, "this"),
      companion: companion2,
      on: {
        back: () => navigate("status"),
        act: (action) => appActions.act(a3, action),
        update: () => appActions.update(a3),
        open: (url) => go().Open(url),
        phone: () => appActions.phone(a3),
        signIn: (keys) => appActions.signIn(a3, keys),
        // The app's clipboard, or the browser's on a phone.
        copy: async (text) => {
          if (window.runtime.ClipboardSetText) await window.runtime.ClipboardSetText(text);
          else await navigator.clipboard.writeText(text);
          return "Copied";
        },
        logs: (lines) => go().Logs(id, lines),
        explain: () => go().ExplainLogs(id),
        // Backups runs it, in its own panel with its progress.
        backupNow: () => {
          navigate("backups");
          $2("backupNow").click();
        },
        openBackups: () => navigate("backups"),
        setting: (setting, on) => setSetting(a3.id, setting, on),
        remove: () => cliFlow(`Remove ${a3.name}: a backup of its data first, then its container goes`, "remove", a3.id, "Back up and remove"),
        openPeople: () => {
          navigate("settings");
          $2("peopleCard")?.scrollIntoView({ block: "start" });
        }
      }
    });
  }
  statusData.watch(() => {
    if (shown2()) draw2();
  });
  backupsData.watch(() => {
    if (shown2()) draw2();
  });
  watchRows(() => {
    if (shown2()) draw2();
  });

  // web/src/app.ts
  function show(name) {
    const picked = name === "app" ? "status" : name;
    $$("nav button").forEach((b2) => {
      b2.classList.toggle("active", b2.dataset.screen === picked);
      if (b2.dataset.screen === picked) b2.setAttribute("aria-current", "page");
      else b2.removeAttribute("aria-current");
    });
    document.querySelectorAll(".screen").forEach((s3) => s3.classList.toggle("active", s3.id === name));
    setupNav();
    freshen(name);
  }
  function freshen(name) {
    if (name === "status") {
      statusData.fresh(minute);
      healthData.fresh(minute);
    }
    if (name === "app") {
      statusData.fresh(minute);
      refreshApp();
    }
    if (name === "backups") {
      backupsData.fresh(minute);
      jobsData.fresh(minute);
    }
    if (name === "setup") {
      hostData.fresh(minute);
      stepsData.fresh(minute);
      healthData.fresh(minute);
    }
    if (name === "settings") {
      hostData.fresh(minute);
      if (!Object.keys(changed).length) settingsData.fresh(minute);
    }
  }
  function reload(name) {
    if (name === "status") {
      loadStatus();
      healthData.load();
    }
    if (name === "app") {
      loadStatus();
      refreshApp();
    }
    if (name === "backups") loadBackups();
    if (name === "setup") {
      loadHost().catch(showError);
      loadSetup();
      healthData.load();
    }
    if (name === "settings") {
      loadSettings();
      loadHost().catch(showError);
    }
  }
  function focusScreen(name) {
    const h1 = $1(`#${name} h1`);
    if (!h1) return;
    h1.tabIndex = -1;
    h1.focus({ preventScroll: true });
  }
  var navigated = false;
  function navigate(name) {
    if (name === "update") {
      navigated = true;
      show("status");
      updateFromMenu();
      return;
    }
    navigated = true;
    show(name);
  }
  $$("nav button").forEach((b2, i3) => {
    b2.onclick = () => {
      navigate(b2.dataset.screen);
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
      if (current) reload(current);
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
      navigate("settings");
    } else if (n2 >= 1 && n2 <= screens.length) {
      e3.preventDefault();
      navigate(screens[n2 - 1]);
    } else if (e3.key.toLowerCase() === "r") {
      e3.preventDefault();
      if (current) reload(current);
    } else if (e3.key.toLowerCase() === "f") {
      const search = { choose: "search", settings: "settingsSearch" }[current];
      if (search) {
        e3.preventDefault();
        $2(search).focus();
        $2(search).select();
      }
    }
  });
  window.addEventListener("load", async () => {
    window.runtime.EventsOn("navigate", (screen) => {
      navigate(screen);
    });
    window.runtime.EventsOn("status:changed", refreshStatus);
    window.runtime.EventsOn("cli:step", cliProgress);
    window.runtime.EventsOn("job:app", jobApp);
    window.runtime.EventsOn("refresh", () => {
      const current = document.querySelector(".screen.active")?.id;
      if (current) reload(current);
    });
    await loadAppearance();
    const last = Promise.resolve().then(() => go().LastStatus());
    try {
      const info = await loadHost();
      if (!info.rootOK) return show("setup");
      await loadCatalog();
      await drawRemembered(last);
      const steps = stepsData.load();
      if (document.documentElement.classList.contains("kiosk")) return show("status");
      const screen = await go().Screen();
      if (screen) return screen.startsWith("app:") ? openApp(screen.slice(4)) : navigate(screen);
      await steps;
      if (stepsData.error) throw stepsData.error;
      if (progress(stepsData.value).left && !navigated) show("setup");
    } catch (e3) {
      showError(e3);
      show("setup");
    }
  });
})();
