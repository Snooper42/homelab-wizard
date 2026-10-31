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
    const open2 = s3.state !== "waiting" && s3.state !== "done";
    const items = [
      open2 && !!s3.settings?.length && /* @__PURE__ */ u3("button", { class: "small", onClick: () => on.fill(s3.settings), children: "Fill in settings" }),
      open2 && !!s3.run?.length && /* @__PURE__ */ u3("button", { class: "small", disabled: running3, onClick: () => on.run(s3), children: s3.runLabel || "Run" }),
      ...open2 ? (s3.choices || []).map((c3, ci) => /* @__PURE__ */ u3("button", { class: "small choice", disabled: running3, onClick: () => on.run(s3, ci), children: c3.label })) : [],
      open2 && s3.open && /* @__PURE__ */ u3(ActionLink, { onClick: () => on.open(s3.open), children: "Open " + s3.open.replace(/^https?:\/\//, "").replace(/\/$/, "") }),
      open2 && s3.id === "vaultwarden" && /* @__PURE__ */ u3("button", { class: "small", onClick: on.closeSignups, children: "Close sign-ups now" }),
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
  function Fold({ id: id2, cls, title, names: names2, shown: shown5, toggle }) {
    return /* @__PURE__ */ u3("li", { class: "fold " + cls, children: [
      /* @__PURE__ */ u3("span", { class: "mark", children: cls === "done" ? /* @__PURE__ */ u3(Icon, { name: "check" }) : /* @__PURE__ */ u3(Icon, { name: "clock" }) }),
      /* @__PURE__ */ u3("div", { class: "body", children: [
        /* @__PURE__ */ u3("strong", { class: "title", children: title }),
        !shown5 && names2 && /* @__PURE__ */ u3("span", { class: "names muted", children: " · " + names2 })
      ] }),
      /* @__PURE__ */ u3("div", { class: "actions", children: /* @__PURE__ */ u3("button", { id: id2, class: "linkbtn small", "aria-expanded": shown5, onClick: toggle, children: shown5 ? "Hide" : "Show" }) })
    ] });
  }
  function Checklist({ steps, showDone, showLater, running: running3, on }) {
    const [opened2, setOpened] = d2({});
    const toggle = (id2) => setOpened({ ...opened2, [id2]: !opened2[id2] });
    const now = steps.filter((s3) => !waits(s3) && s3.state !== "done");
    const later2 = steps.filter(waits);
    const done = steps.filter((s3) => s3.state === "done");
    const row = (s3, n2) => {
      const open2 = !!opened2[s3.id];
      const more = s3.why || s3.detail;
      return (
        // A row: the step's number, what it gives you (one line until it is
        // opened), its buttons, and the chevron that opens it.
        /* @__PURE__ */ u3("li", { class: s3.state + (open2 ? " open" : ""), children: [
          /* @__PURE__ */ u3("span", { class: "mark", children: s3.state === "done" ? /* @__PURE__ */ u3(Icon, { name: "check" }) : String(n2) }),
          /* @__PURE__ */ u3("div", { class: "body", children: [
            /* @__PURE__ */ u3("strong", { class: "title", children: s3.title }),
            /* @__PURE__ */ u3("div", { class: "sub muted", children: s3.why }),
            open2 && s3.state !== "done" && s3.detail && /* @__PURE__ */ u3("div", { class: "sub detail", children: s3.detail })
          ] }),
          /* @__PURE__ */ u3(Actions, { s: s3, running: running3 === s3.id, on }),
          more && /* @__PURE__ */ u3("button", { class: "iconbtn more", "aria-expanded": open2, "aria-label": (open2 ? "Less about: " : "More about: ") + s3.title, onClick: () => toggle(s3.id), children: /* @__PURE__ */ u3(Icon, { name: "chevron" }) })
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
  var monthFirst = /^12/.test(new Date(2e3, 11, 31).toLocaleDateString());
  var hourCycle = new Intl.DateTimeFormat(void 0, { hour: "numeric" }).resolvedOptions().hourCycle;
  var dateLocale = monthFirst ? "en-US" : "en-GB";
  var hour12 = hourCycle === "h11" || hourCycle === "h12";
  var dayText = (d3, o3) => d3.toLocaleDateString(dateLocale, o3);
  var clockText = (d3) => d3.toLocaleTimeString(dateLocale, { hour: "numeric", minute: "2-digit", hour12 });
  var dateTimeText = (d3) => d3.toLocaleString(dateLocale, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12 });
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
    const since = dayText(/* @__PURE__ */ new Date(first.date + "T12:00:00"), { month: "short", day: "numeric" });
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
  function Tiles({ status: st, history, onPause, onChoose }) {
    if (!st.apps.length) {
      return /* @__PURE__ */ u3(Card, { kind: "emptystate", id: "statusEmpty", children: [
        /* @__PURE__ */ u3("h2", { children: "No apps yet" }),
        /* @__PURE__ */ u3("p", { children: "Pick a few on Choose stacks. They show up here as they start, with their addresses." }),
        /* @__PURE__ */ u3("button", { class: "btn primary", onClick: onChoose, children: "Choose stacks" })
      ] });
    }
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
          sub: st.missing ? /* @__PURE__ */ u3("span", { class: "bad", children: st.missing === 1 ? "1 baseline app is down" : `${st.missing} baseline apps are down` }) : "All baseline apps are up"
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
  function Row({ dot, lead, title, sub, subTone, children, end, when: when2, whenTitle, whenPlain, onOpen, openLabel }) {
    const Box = onOpen ? "span" : "div";
    const body = /* @__PURE__ */ u3(S, { children: [
      dot !== void 0 && /* @__PURE__ */ u3("span", { class: "dot " + dot }),
      lead,
      /* @__PURE__ */ u3(Box, { class: "grow", children: [
        title !== void 0 && /* @__PURE__ */ u3("strong", { children: title }),
        !!sub && /* @__PURE__ */ u3(Box, { class: (subTone || "muted") + (onOpen ? " line" : ""), children: sub }),
        children
      ] }),
      end,
      when2 !== void 0 && /* @__PURE__ */ u3("span", { class: whenPlain ? "when" : "when muted", title: whenTitle, children: when2 })
    ] });
    if (!onOpen) return /* @__PURE__ */ u3("li", { children: body });
    return /* @__PURE__ */ u3("li", { class: "opens", children: /* @__PURE__ */ u3("button", { type: "button", class: "rowopen", onClick: onOpen, children: [
      body,
      openLabel && /* @__PURE__ */ u3("span", { class: "sr", children: [
        ", ",
        openLabel
      ] })
    ] }) });
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
    const shown5 = events.slice(0, 5);
    const tone = (e3) => (e3.priority || 0) >= 4 ? "bad" : (e3.tags || []).includes("white_check_mark") || /^recovered/i.test(e3.title || "") ? "ok" : "";
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: "Recent alerts", children: /* @__PURE__ */ u3("span", { class: "muted", children: [
        events.length,
        " in the last 12 hours"
      ] }) }),
      /* @__PURE__ */ u3(Rows, { children: shown5.map((e3) => /* @__PURE__ */ u3(
        Row,
        {
          dot: tone(e3),
          title: e3.title || e3.message,
          sub: e3.title && e3.message && e3.message.split("\n").map((line, i3) => /* @__PURE__ */ u3("div", { children: line }, i3)),
          end: /* @__PURE__ */ u3("span", { class: "badge", children: topicName[e3.topic] || e3.topic }),
          when: ago(e3.time)
        },
        e3.id
      )) }),
      events.length > shown5.length && /* @__PURE__ */ u3("div", { class: "muted more", children: [
        "and ",
        events.length - shown5.length,
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

  // web/src/parts/Address.tsx
  function Address({ text: text2 }) {
    return /* @__PURE__ */ u3(S, { children: text2.split(new RegExp("(?<=[.:])")).map((t3, i3) => /* @__PURE__ */ u3(S, { children: [
      i3 ? /* @__PURE__ */ u3("wbr", {}) : null,
      t3
    ] })) });
  }

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
    const words2 = { stopped: ["warn", "Stopped"], missing: ["bad", "Not running"], elsewhere: ["warn", "Runs elsewhere"], "not running": ["warn", "Not running"] };
    return words2[a3.state] || ["", a3.state];
  }
  var doing = { start: "Starting…", stop: "Stopping…", restart: "Restarting…", update: "Updating…", rollback: "Rolling back…" };
  var verb = { start: "start", stop: "stop", restart: "restart", update: "update", rollback: "roll back" };
  function Link({ url, text: text2, open: open2 }) {
    return /* @__PURE__ */ u3(ActionLink, { onClick: () => open2(url), children: /* @__PURE__ */ u3(Address, { text: text2 }) });
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
  function NativeButton({ a: a3, title, label, open: open2 }) {
    const [busy, setBusy] = d2(false);
    return /* @__PURE__ */ u3("button", { class: "small", title, disabled: busy, onClick: () => {
      setBusy(true);
      open2().catch(() => setBusy(false));
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
    const [cls, words2] = pend && !pend.failed ? ["warn", doing[pend.action] || "Working…"] : stateOf(a3, p3.batteryPaused);
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
              words2,
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
  function GroupHead({ g: g2, open: open2, toggle, p: p3 }) {
    const running3 = g2.apps.filter((a3) => a3.state === "running").length;
    const counted = g2.apps.filter((a3) => !awaitingJobs(a3)).length;
    return /* @__PURE__ */ u3("tr", { class: "grouphead fold" + (g2.alert ? " bad" : "") + (open2 ? " open" : ""), onClick: toggle, children: /* @__PURE__ */ u3("th", { colSpan: 4, children: [
      /* @__PURE__ */ u3("button", { type: "button", class: "foldbtn", "aria-expanded": open2, onClick: (e3) => {
        e3.stopPropagation();
        toggle();
      }, children: [
        /* @__PURE__ */ u3("span", { class: "chev", "aria-hidden": "true", children: open2 ? "▾" : "▸" }),
        g2.label
      ] }),
      /* @__PURE__ */ u3("span", { class: "n", children: g2.alert ? String(g2.apps.length) : running3 >= counted ? `${running3} running ✓` : `${running3} of ${counted} running` }),
      /* @__PURE__ */ u3(StartAll, { g: g2, p: p3 }),
      !open2 && /* @__PURE__ */ u3("span", { class: "names", children: g2.apps.map((a3) => a3.name).join(" · ") })
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
  function openGroups(groups3, f4) {
    const fine = (g2) => !g2.alert && g2.apps.every((a3) => a3.state === "running" || awaitingJobs(a3));
    return Object.fromEntries(groups3.map((g2) => [g2.label, f4.all || (g2.label in f4.picked ? f4.picked[g2.label] : !fine(g2))]));
  }
  function AppList(p3) {
    const f4 = useFold();
    const open2 = openGroups(p3.groups, f4);
    const toggle = (label) => setFold({ all: false, picked: { ...f4.all ? open2 : f4.picked, [label]: !open2[label] } });
    return /* @__PURE__ */ u3(S, { children: p3.groups.flatMap((g2) => [
      /* @__PURE__ */ u3(GroupHead, { g: g2, open: open2[g2.label], toggle: () => toggle(g2.label), p: p3 }, "g:" + g2.label),
      ...open2[g2.label] ? g2.apps.map((a3) => /* @__PURE__ */ u3(Row2, { a: a3, p: p3 }, a3.id)) : []
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
    return isNaN(d3.getTime()) || d3.getFullYear() < 2e3 ? "" : dayText(d3, { day: "numeric", month: "short", year: "numeric" });
  };
  function ReleaseNotes({ name, load, onUpdate, onCancel, open: open2 }) {
    const [preview, setPreview] = d2(null);
    const [problem, setProblem] = d2("");
    h2(() => {
      let live = true;
      load().then((p3) => live && setPreview(p3), (e3) => live && setProblem(String(e3?.message || e3)));
      return () => {
        live = false;
      };
    }, []);
    const shown5 = preview?.releases.slice(0, 5) || [];
    return /* @__PURE__ */ u3("div", { class: "notes", children: [
      !preview && !problem && /* @__PURE__ */ u3("p", { class: "muted", children: "Reading what is new…" }),
      problem && /* @__PURE__ */ u3("p", { class: "muted", children: [
        "Its release notes could not be read (",
        problem,
        "). Updating still works."
      ] }),
      preview && /* @__PURE__ */ u3("p", { children: summary(name, preview) }),
      shown5.map((r3) => /* @__PURE__ */ u3("section", { class: "release", children: [
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
          open2(r3.url);
        }, children: "Full notes" })
      ] }, r3.tag)),
      preview && preview.releases.length > shown5.length && preview.page && /* @__PURE__ */ u3("p", { class: "muted", children: [
        "And ",
        preview.releases.length - shown5.length,
        " older ones: ",
        /* @__PURE__ */ u3("a", { href: "#", onClick: (e3) => {
          e3.preventDefault();
          open2(preview.page);
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
  function StatusNote({ text: text2, down }) {
    if (!down) return /* @__PURE__ */ u3(S, { children: text2 });
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
  var field = "input:not([disabled]):not([type=hidden]):not([type=checkbox]), select:not([disabled]), textarea:not([disabled])";
  var openSheets = () => [...document.querySelectorAll(".panel.sheet:not([hidden])")];
  var stops = (sheet) => [...sheet.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter((e3) => e3.getClientRects().length > 0);
  var listening = false;
  function keys() {
    if (listening) return;
    listening = true;
    document.addEventListener("keydown", (e3) => {
      const open2 = openSheets().pop();
      if (!open2) return;
      if (e3.key === "Escape") {
        const close3 = [...open2.querySelectorAll("button:not([disabled])")].find((b2) => /^(Close|Cancel)$/.test(b2.textContent.trim()));
        if (close3) {
          e3.preventDefault();
          close3.click();
        }
      } else if (e3.key === "Tab") {
        const all = stops(open2);
        if (!all.length) {
          e3.preventDefault();
          open2.focus();
          return;
        }
        const at = all.indexOf(document.activeElement);
        const next = at < 0 ? e3.shiftKey ? all.length - 1 : 0 : at + (e3.shiftKey ? -1 : 1);
        if (at < 0 || next < 0 || next >= all.length) {
          e3.preventDefault();
          all[(next + all.length) % all.length].focus();
        }
      }
    });
  }
  function Sheet({ id: id2, titleId, onClose, children }) {
    const ref = A2(null);
    _2(() => {
      keys();
      const panel = ref.current;
      let before = null;
      const seen = new MutationObserver(() => {
        document.documentElement.classList.toggle("sheet-open", openSheets().length > 0);
        if (!panel.hidden) {
          if (!panel.contains(document.activeElement)) before = document.activeElement;
          requestAnimationFrame(() => {
            panel.scrollTop = 0;
            (panel.querySelector(field) || panel.querySelector("button:not([disabled])") || panel).focus();
          });
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
  function PhoneCode({ url, img, tailnet, phoneApp, close: close3 }) {
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
        /* @__PURE__ */ u3("button", { class: "small", onClick: close3, children: "Close" })
      ] })
    ] });
  }
  function SignIns({ rows, close: close3 }) {
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
      /* @__PURE__ */ u3("button", { class: "small", onClick: close3, children: "Close" })
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
    if (days < 7) return "on " + dayText(d3, { weekday: "long" });
    return "on " + dayText(d3, { day: "numeric", month: "long" });
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
    const words2 = view.query.toLowerCase().split(/\s+/).filter(Boolean);
    const out = { keys: /* @__PURE__ */ new Set(), counts: {}, pageMore: 0 };
    for (const pg of pages) {
      const here = pg.name === view.page;
      for (const s3 of pg.items) {
        const more = pg.kind === "general" && !wanted.has(s3.key);
        if (here && more) out.pageMore++;
        const step2 = checks[s3.key];
        const text2 = [pg.name, label(s3.key), s3.key.replace(/_/g, " "), s3.help || "", step2 ? step2.title : "", "setting-" + s3.key].join(" ").toLowerCase();
        const match = words2.length ? words2.every((w3) => text2.includes(w3)) : here && (view.showAll || !more);
        if (match) {
          out.keys.add(s3.key);
          out.counts[pg.name] = (out.counts[pg.name] || 0) + 1;
        }
      }
    }
    return out;
  }
  function plainHelp(help, toggle) {
    const words2 = help.replace(/\s*\((?:\.\/)?homelab [^)]*\)/g, "");
    if (!toggle) return words2;
    return words2.split(new RegExp("(?<=\\.)\\s+")).filter((t3) => !/^(true|false)\b/i.test(t3)).join(" ");
  }
  function Row3({ s: s3, p: p3, value, hidden, edit }) {
    const [result, setResult] = d2(null);
    const [testing, setTesting] = d2(false);
    const [kept, setKept] = d2(void 0);
    const step2 = p3.checks[s3.key];
    const toggle = !s3.secret && /^(true|false)$/i.test(s3.value || "");
    const label = p3.label(s3.key);
    const input2 = toggle ? /* @__PURE__ */ u3("input", { type: "checkbox", class: "switch", role: "switch", "aria-label": label, checked: /^true$/i.test(value ?? kept ?? s3.value), onChange: (e3) => edit(s3.key, e3.currentTarget.checked ? "true" : "false") }) : /* @__PURE__ */ u3(
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
          input2,
          buttons
        ] }) : input2,
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
  function AddPerson({ apps, open: open2, on }) {
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
    return /* @__PURE__ */ u3("details", { class: "addperson", open: open2, children: [
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
  var financesChoices = [["", "No Finances"], ["view", "Sees Finances"], ["edit", "Changes Finances"]];
  function FinancesPick({ value, set: set2, label, id: id2 }) {
    return /* @__PURE__ */ u3("select", { id: id2, class: "finpick", "aria-label": label, value, onChange: (e3) => set2(e3.currentTarget.value), children: financesChoices.map(([v3, t3]) => /* @__PURE__ */ u3("option", { value: v3, children: t3 }, v3)) });
  }
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
          " link (the home Wi-Fi, without encryption) can only look, and never sees Finances, so that nobody else on the Wi-Fi can copy its key or read your money. To make changes or see Finances from a phone, pair it with an ",
          /* @__PURE__ */ u3("code", { children: "https:" }),
          " link."
        ] }),
        !!links.length && /* @__PURE__ */ u3("p", { class: "muted", children: [
          "A TV or a wall screen pairs the same way, with ",
          /* @__PURE__ */ u3("code", { children: "&kiosk" }),
          " at the end of the link (",
          /* @__PURE__ */ u3("code", { children: links[0] + "&kiosk" }),
          "): it then shows Status only, large, without buttons, and stays on. A screen can never make changes or show Finances, whatever is picked here."
        ] }),
        /* @__PURE__ */ u3("button", { class: "small", onClick: done, children: "Done" })
      ] })
    ] }) });
  }
  function Phones({ phones, on }) {
    const [name, setName] = d2("");
    const [canChange, setCanChange] = d2(false);
    const [finances, setFinances] = d2("");
    const [pairing, setPairing] = d2(null);
    const pair = async () => {
      try {
        setPairing(await on.pair(name, canChange, finances));
      } catch {
      }
    };
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: "Phones", children: /* @__PURE__ */ u3("span", { class: "muted", children: phones.length ? `${phones.length} paired` : "none paired yet" }) }),
      /* @__PURE__ */ u3("p", { class: "muted", children: "Status and Backups on your phones, at home and on the tailnet (never on the internet). Each phone pairs once with a code; it can only look unless you let it make changes, and it sees Finances only if you pick that for it." }),
      !!phones.length && /* @__PURE__ */ u3(Rows, { children: phones.map((p3) => /* @__PURE__ */ u3(
        Row,
        {
          dot: p3.canChange ? "warn" : "ok",
          title: p3.name,
          sub: /* @__PURE__ */ u3(S, { children: [
            p3.canChange ? "Can make changes" : p3.unencrypted ? "Looks only (paired over the home Wi-Fi, without encryption)" : "Looks only",
            p3.finances === "edit" ? " · changes Finances" : p3.finances === "view" ? " · sees Finances" : "",
            " · last seen ",
            ago(p3.lastSeen)
          ] }),
          end: /* @__PURE__ */ u3(S, { children: [
            !p3.unencrypted && /* @__PURE__ */ u3(FinancesPick, { value: p3.finances || "", set: (level) => on.setFinances(p3.id, level), label: `Finances on ${p3.name}` }),
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
        /* @__PURE__ */ u3(FinancesPick, { id: "phoneFinances", value: finances, set: setFinances, label: "Finances on the new phone" }),
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
  function PagePicker({ groups: groups3, active: active2, counts, pick }) {
    const option = (name) => /* @__PURE__ */ u3("option", { value: name, children: counts && counts[name] ? `${name} (${counts[name]})` : name }, name);
    return /* @__PURE__ */ u3("label", { class: "pagepick", children: [
      /* @__PURE__ */ u3("span", { children: "Page" }),
      /* @__PURE__ */ u3("select", { value: counts ? "" : active2, onChange: (e3) => pick(e3.currentTarget.value), children: [
        counts && /* @__PURE__ */ u3("option", { value: "", disabled: true, children: "Matches on…" }),
        groups3.filter((g2) => g2.items.length).flatMap((g2) => {
          const pages = g2.items.filter((i3) => typeof i3 === "string");
          const folds = g2.items.filter((i3) => typeof i3 !== "string");
          return [
            ...pages.length ? [/* @__PURE__ */ u3("optgroup", { label: g2.head, children: pages.map(option) }, "h:" + g2.head)] : [],
            ...folds.map((f4) => /* @__PURE__ */ u3("optgroup", { label: pages.length ? f4.label : `${g2.head} › ${f4.label}`, children: f4.pages.map(option) }, "f:" + f4.label))
          ];
        })
      ] })
    ] });
  }
  function Nav({ groups: groups3, active: active2, counts, pick }) {
    const [picked, setPicked] = d2({});
    const matches2 = (f4) => !!counts && f4.pages.some((p3) => counts[p3]);
    const isOpen = (f4) => counts ? matches2(f4) : picked[f4.label] ?? f4.pages.includes(active2);
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(PagePicker, { groups: groups3, active: active2, counts, pick }),
      groups3.filter((g2) => g2.items.length).map((g2) => [
        /* @__PURE__ */ u3("div", { class: "navhead", children: g2.head }, "h:" + g2.head),
        ...g2.items.map((item) => {
          if (typeof item === "string") return /* @__PURE__ */ u3(PageButton, { name: item, active: active2, counts, pick }, item);
          const f4 = item, open2 = isOpen(f4);
          const n2 = counts ? f4.pages.reduce((sum, p3) => sum + (counts[p3] || 0), 0) : f4.pages.length;
          return [
            /* @__PURE__ */ u3(
              "button",
              {
                class: "navfold" + (open2 ? " open" : "") + (counts && !n2 ? " nomatch" : ""),
                "aria-expanded": open2,
                onClick: () => setPicked({ ...picked, [f4.label]: !open2 }),
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
            ...open2 ? f4.pages.map((name) => /* @__PURE__ */ u3(PageButton, { name, active: active2, counts, pick, inFold: true }, name)) : []
          ];
        })
      ])
    ] });
  }
  function mountNav(el, props) {
    R(/* @__PURE__ */ u3(Nav, { ...props }), el);
  }

  // web/src/parts/Segmented.tsx
  function Segmented({ label, value, options, pick }) {
    return /* @__PURE__ */ u3("div", { class: "seg", role: "radiogroup", "aria-label": label, children: options.map(([v3, text2]) => /* @__PURE__ */ u3("button", { type: "button", role: "radio", "aria-checked": value === v3, class: value === v3 ? "on" : "", onClick: () => pick(v3), children: text2 }, v3)) });
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
  function primaryOn(hex, text2) {
    if (luminance(hex) > 0.4) return [hex, text2 || "#0b0f19"];
    let c3 = hex;
    for (let i3 = 1; contrast(c3, "#ffffff") < 4.5 && i3 <= 20; i3++) c3 = mix(hex, "#000000", i3 * 0.05);
    return [c3, "#ffffff"];
  }
  var setPrimary = (root, name, hex, text2) => {
    const [bg, fg] = primaryOn(hex, text2);
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
    return /* @__PURE__ */ u3(ActionLink, { id: "upgradeBack", title: `The homelab files as they were before the update of ${dateTimeText(new Date(p3.when))}; settings and data stay`, onClick: click, children: sure ? `click again to go back to ${p3.version}` : `go back to ${p3.version} (${p3.commit.slice(0, 7)})` });
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
  function Runtime({ i: i3, start, open: open2 }) {
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
          i3.runtimeDownload && /* @__PURE__ */ u3("button", { id: "getRuntime", class: "primary", onClick: () => open2(i3.runtimeDownload), children: "Open the install guide" }),
          /* @__PURE__ */ u3("span", { class: "muted", children: moves })
        ] })
      ] }) : /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("ol", { children: [
          /* @__PURE__ */ u3("li", { children: `Download ${i3.runtime}, the engine every app runs in.` }),
          /* @__PURE__ */ u3("li", { children: "Open the downloaded file and drag it to Applications (or run the installer)." }),
          /* @__PURE__ */ u3("li", { children: "Open it once and accept what it asks." })
        ] }),
        /* @__PURE__ */ u3("div", { class: "actions", children: [
          i3.runtimeDownload && /* @__PURE__ */ u3("button", { id: "getRuntime", class: "primary", onClick: () => open2(i3.runtimeDownload), children: `Download ${i3.runtime}` }),
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
  function Inputs({ keys: keys2, meta, values, label, input: input2 }) {
    return /* @__PURE__ */ u3(S, { children: [
      !!keys2.length && /* @__PURE__ */ u3("h2", { children: "Settings they need" }),
      keys2.map((k3) => {
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
              onInput: (e3) => input2(k3, e3.currentTarget.value)
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
  function Started({ started, open: open2 }) {
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: "Ready to open" }),
      started.length ? /* @__PURE__ */ u3("ul", { children: started.map((s3) => /* @__PURE__ */ u3("li", { children: s3.url ? /* @__PURE__ */ u3(ActionLink, { onClick: () => open2(s3.url), children: s3.name }) : s3.name }, s3.id)) }) : /* @__PURE__ */ u3("p", { class: "muted", children: "Nothing new to start." })
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
  function mountCategories(el, categories2) {
    R(/* @__PURE__ */ u3(S, { children: categories2.map((c3) => /* @__PURE__ */ u3("option", { value: c3.id, children: c3.label }, c3.id)) }), el);
  }

  // web/src/core.ts
  var go = () => window.go.main.App;
  var $2 = (id2) => document.getElementById(id2);
  var $$ = (sel2, root = document) => [...root.querySelectorAll(sel2)];
  var $1 = (sel2, root = document) => root.querySelector(sel2);
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
  function namesFor(text2) {
    const byID = Object.fromEntries((catalog?.apps || []).map((a3) => [a3.id, a3.name]));
    return text2.replace(/[a-z0-9][a-z0-9-]*[a-z0-9]/g, (w3) => byID[w3] || w3);
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
      settings: (keys2) => showSettings(keys2),
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
    return r3.replace(/set ([A-Z0-9_]+(?:(?:, | and | or )[A-Z0-9_]+)*) in \.env first/g, (_3, keys2) => "fill in " + keys2.split(/, | and | or /).map(settingLabel).join(" and ") + " below");
  }
  var settingHelp = null;
  async function renderInputs(p3) {
    const ids = /* @__PURE__ */ new Set([...selected, ...p3.start, ...p3.skips.map((s3) => s3.app)]);
    const keys2 = [...new Set(catalog.apps.filter((a3) => ids.has(a3.id)).flatMap((a3) => a3.inputs || []))];
    if (keys2.length && !settingHelp) {
      try {
        settingHelp = Object.fromEntries((await go().Settings()).map((s3) => [s3.key, s3]));
      } catch {
        settingHelp = {};
      }
    }
    mountInputs($2("inputs"), { keys: keys2, meta: settingHelp || {}, values: settings, label: settingLabel, input: (k3, v3) => {
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
    const words2 = { env: "Saving your settings", folders: "Making the folders", networks: "Getting the network ready" };
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
      const text2 = ev.name === "start" ? `Starting ${(ev.apps || []).map(appName).join(", ")}` : words2[ev.name];
      cliProgress({ n: ev.step, total: ev.steps + 1, text: text2 });
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
    const draw4 = () => mountWiring(box, { links: [...done], note });
    draw4();
    const off = window.runtime.EventsOn("link", (l3) => {
      done.push(l3);
      draw4();
    });
    try {
      const links = await go().Wire();
      note = links.length ? "" : "Nothing to connect: none of the apps it links is running.";
      draw4();
    } catch (e3) {
      showError(e3);
    } finally {
      if (typeof off === "function") off();
    }
  }
  $2("connect").onclick = () => wire($2("statusWiring"));

  // web/src/updates/UpdateLine.tsx
  var running = (step2) => !!step2 && step2.step !== "done" && step2.step !== "failed";
  var lineShown = (s3, step2) => !!step2 || !!s3 && (s3.state === "ready" || s3.state === "blocked" || !!s3.updated || !!s3.notInstalled);
  function Notes({ notes }) {
    return /* @__PURE__ */ u3("ul", { id: "updateNotes", children: [
      notes.slice(0, 12).map((n2, i3) => /* @__PURE__ */ u3("li", { children: n2 }, i3)),
      notes.length > 12 && /* @__PURE__ */ u3("li", { class: "muted", children: `and ${notes.length - 12} more` })
    ] });
  }
  function UpdateLine({ s: s3, step: step2, download: download2, log: log2, update, later: later2, close: close3, open: open2 }) {
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
    } else if (s3.notInstalled && !step2) {
      mark = "!";
      tone = "failed";
      head = v3 ? `Homelab Wizard ${v3} did not install` : "The update did not install";
      sub = s3.notInstalled;
      end = /* @__PURE__ */ u3(S, { children: [
        s3.page && /* @__PURE__ */ u3("button", { id: "updateDownload", class: "small", onClick: () => open2(s3.page), children: "Download it" }),
        s3.state === "ready" && /* @__PURE__ */ u3("button", { id: "updateRetry", class: "small", onClick: update, children: "Try again" }),
        /* @__PURE__ */ u3("button", { id: "updateClose", class: "iconbtn", "aria-label": "Close", onClick: close3, children: "×" })
      ] });
    } else if (s3.updated && (step2?.step === "done" || s3.state !== "ready")) {
      mark = "✓";
      tone = "done";
      head = s3.updated.version ? `Updated to ${s3.updated.version}` : "Updated";
      end = /* @__PURE__ */ u3(S, { children: [
        whatsNew(s3.updated.notes || []),
        /* @__PURE__ */ u3("button", { id: "updateClose", class: "iconbtn", "aria-label": "Close", onClick: close3, children: "×" })
      ] });
      below = more && /* @__PURE__ */ u3(Notes, { notes: s3.updated.notes || [] });
    } else if (s3.state === "blocked") {
      mark = "!";
      tone = "blocked";
      head = v3 ? `Homelab Wizard ${v3} is ready` : "An update is ready";
      sub = s3.blocked || "";
      end = s3.page ? /* @__PURE__ */ u3("button", { id: "updateDownload", class: "small", onClick: () => open2(s3.page), children: "Download it" }) : null;
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
    const hidden = !running2() && step?.step !== "failed" && ready() && laterKey === key(state) && !state.updated && !state.notInstalled;
    const shown5 = lineShown(state, step) && !hidden;
    box.hidden = !shown5;
    box.className = "updateline" + (step?.step === "failed" ? " failed" : state.updated && !ready() && !running2() ? " done" : "");
    mountUpdateLine(box, shown5 ? { s: state, step, download, log, update: updateNow, later, close, open: (url) => go().Open(url) } : null);
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
    if (state) state = { ...state, updated: void 0, notInstalled: void 0 };
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
    fill: (keys2) => showSettings(keys2),
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
    setFinances: async (id2, level) => {
      try {
        await go().SetPhoneFinances(id2, level);
      } catch (e3) {
        showError(e3);
      }
      loadPhones();
    },
    pair: async (name, can, finances) => {
      try {
        return await go().PairPhone(name, can, finances);
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
      const save2 = {};
      for (const k3 of testReads[key2] || []) if (k3 in changed && !(isSecret(k3) && changed[k3] === "")) save2[k3] = changed[k3];
      if (pending2 !== void 0) {
        if (!(isSecret(key2) && pending2 === "")) save2[key2] = pending2;
        used = true;
      }
      if (Object.keys(save2).length) {
        try {
          await go().SaveSettings(save2);
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
    const groups3 = pageGroups.map(([head, names2]) => ({ head, items: names2.filter((n2) => general.includes(n2)) }));
    const named3 = new Set(pageGroups.flatMap(([, names2]) => names2));
    groups3[0].items.push(...general.filter((n2) => !named3.has(n2)));
    const cats = catalog?.categories || [];
    const catOf = (name) => (catalog?.apps || []).find((a3) => a3.kind !== "helper" && (name === a3.name || name.startsWith(a3.name + " ")))?.category || "";
    const folds = cats.map((c3) => ({ label: c3.label, pages: mine.filter((p3) => p3.name !== "Other apps" && catOf(p3.name) === c3.id).map((p3) => p3.name) })).filter((f4) => f4.pages.length);
    const loose = mine.filter((p3) => p3.name !== "Other apps" && !cats.some((c3) => c3.id === catOf(p3.name))).map((p3) => p3.name);
    const other = mine.some((p3) => p3.name === "Other apps") ? ["Other apps"] : [];
    navGroups = [
      ...groups3,
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
    const words2 = (app ? app[1] : key2).split("_").filter(Boolean).map((w3) => wordLabels[w3] || (upper.has(w3) ? w3 : w3.toLowerCase()));
    if (app) return [app[0], ...words2].join(" ");
    const text2 = words2.join(" ");
    return text2.charAt(0).toUpperCase() + text2.slice(1);
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
  function showSettings(keys2) {
    settingsFocus = keys2;
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
      },
      onChoose: () => navigate("choose")
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
    const groups3 = [
      { label: "Needs a look", apps: st.apps.filter(trouble), alert: true },
      ...(catalog?.categories || []).map((c3) => ({ label: c3.label, apps: st.apps.filter((a3) => !trouble(a3) && catOf[a3.id] === c3.id) })),
      { label: "Other", apps: st.apps.filter((a3) => !trouble(a3) && !(catalog?.categories || []).some((c3) => c3.id === catOf[a3.id])) }
    ].filter((g2) => g2.apps.length);
    appList = { groups: groups3, pending, catalog, weekUp, batteryPaused, busy: appsBusy, companion: document.documentElement.classList.contains("companion"), os: osName, on: appListActions };
    mountAppList($2("statusRows"), appList);
  }
  async function answerPages(st) {
    let why;
    try {
      why = await go().Answers();
    } catch {
      return;
    }
    applyAnswers(st, why);
  }
  function applyAnswers(st, why) {
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
    showCrash(c3);
  }
  function showCrash(c3) {
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
  var boardNo = 0;
  var boardStatus = null;
  var boardFailed = false;
  var boardAnswers = null;
  async function readStatus() {
    const want = ["watchdog", "crash", "alerts", "storage"];
    if (!savingsHistory.length) want.push("savings");
    if (Date.now() - protectionAt > 6e4) {
      protectionAt = Date.now();
      want.push("protection");
    }
    if (Date.now() - usageAt >= 9e3) {
      usageAt = Date.now();
      want.push("usage");
    }
    if (Date.now() - weekAt >= 6e5) {
      weekAt = Date.now();
      want.push("week");
    }
    const n2 = ++boardNo;
    boardStatus = boardAnswers = null;
    boardFailed = false;
    try {
      const st = await go().StatusBoard(n2, want);
      if (n2 === boardNo) boardStatus = st;
      return st;
    } catch (e3) {
      if (n2 === boardNo) boardFailed = true;
      if (want.includes("protection")) protectionAt = 0;
      if (want.includes("usage")) usageAt = 0;
      if (want.includes("week")) weekAt = 0;
      throw e3;
    }
  }
  window.runtime?.EventsOn?.("status:card", (c3) => {
    if (c3.board === boardNo && boardFailed && c3.name !== "crash") return;
    const err = c3.error ? new Error(c3.error) : null;
    const data = c3.data;
    switch (c3.name) {
      case "watchdog":
        showWatchdog(err ? null : data);
        break;
      case "crash":
        showCrash(err ? null : data);
        break;
      case "savings":
        savingsHistory = !err && data || [];
        if (lastStatus) renderTiles(lastStatus);
        break;
      case "protection":
        showProtection(data, err);
        break;
      case "alerts":
        showAlerts(data, err);
        break;
      case "storage":
        showStorage(err ? null : data);
        break;
      case "usage":
        showUsage(!err && data || []);
        break;
      case "week":
        showWeek(err ? null : data);
        break;
      case "answers":
        if (c3.board !== boardNo) return;
        boardAnswers = data || {};
        if (boardStatus) applyAnswers(boardStatus, boardAnswers);
    }
  });
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
    if (st.checking && !kept) {
      if (st !== boardStatus) answerPages(st);
      else if (boardAnswers) applyAnswers(st, boardAnswers);
    }
    const waiting = [...new Set(st.apps.filter((a3) => a3.state === "stopped" && a3.waitingFor).map((a3) => a3.waitingFor.replace(/^\/Volumes\//, "")))];
    mountStatusNote($2("statusNote"), { text: [
      waiting.length ? `Plug in ${waiting.join(" and ")}: the apps waiting for ${waiting.length === 1 ? "it" : "them"} start within 15 minutes of ${waiting.length === 1 ? "it" : "them"} appearing.` : "",
      batteryPaused.size ? `On battery: ${batteryPaused.size} app${batteryPaused.size === 1 ? "" : "s"} paused until this computer is plugged in (Settings › Battery saver).` : "",
      st.unmatched === 1 ? "1 other container on this machine isn’t a catalog app." : st.unmatched ? `${st.unmatched} other containers on this machine aren’t catalog apps.` : ""
    ].filter(Boolean).join(" ") });
  }
  function showWatchdog(w3) {
    const card = $2("watchCard");
    if (!w3) {
      card.hidden = true;
      return;
    }
    weekUp = w3.week || {};
    if (appList && lastStatus) renderAppList(lastStatus);
    card.hidden = false;
    mountWatchdog(card, { w: w3, openSetup: () => {
      navigate("setup");
    }, fix: () => cliFlow("Fix it", "fix", "", "Fix these") });
  }
  var protectionAt = 0;
  function showProtection(p3, err) {
    const card = $2("protectCard");
    if (err) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    mountProtection(card, { p: p3, fix: () => cliFlow("Fix it", "fix", "", "Fix these") });
  }
  function showStorage(rec) {
    const card = $2("storageCard");
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
    showUsage(stats);
  }
  function showUsage(stats) {
    record(usageHistory, stats);
    mountUsage($2("usageCard"), { stats, history: usageHistory, nameOf: (id2) => catalog?.apps.find((a3) => a3.id === id2)?.name || id2 });
  }
  var usageHistory = /* @__PURE__ */ new Map();
  setInterval(() => {
    if (!document.hidden && $2("status").classList.contains("active")) loadUsage();
  }, 1e4);
  var weekAt = 0;
  function showWeek(w3) {
    const card = $2("weekCard");
    if (!w3) {
      card.hidden = true;
      return;
    }
    card.hidden = !w3.body.split("\n").some(Boolean);
    if (!card.hidden) mountWeek(card, { w: w3 });
  }
  function showAlerts(events, err) {
    const card = $2("alertsCard");
    const openSetup = () => {
      navigate("setup");
    };
    card.hidden = false;
    if (err) mountAlerts(card, { events: null, problem: err.message, openSetup });
    else mountAlerts(card, { events: events || [], openSetup });
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
  async function showSignIn(a3, keys2) {
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
    const rows = keys2.map((k3) => {
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
  var menuItems = () => [...$2("statusMenu").querySelectorAll("[role=menuitem]")].filter((b2) => !b2.hidden && !b2.disabled);
  function closeMenu() {
    $2("statusMenu").hidden = true;
    $2("statusMore").setAttribute("aria-expanded", "false");
  }
  function openMenu(at) {
    $2("statusMenu").hidden = false;
    $2("statusMore").setAttribute("aria-expanded", "true");
    const items = menuItems();
    if (at && items.length) items[at === "first" ? 0 : items.length - 1].focus();
  }
  $2("statusMore").onclick = (e3) => {
    e3.stopPropagation();
    if ($2("statusMenu").hidden) openMenu(e3.detail === 0 ? "first" : void 0);
    else closeMenu();
  };
  $2("statusMore").addEventListener("keydown", (e3) => {
    if (e3.key === "ArrowDown" || e3.key === "ArrowUp") {
      e3.preventDefault();
      openMenu(e3.key === "ArrowDown" ? "first" : "last");
    }
  });
  $2("statusMenu").addEventListener("keydown", (e3) => {
    const items = menuItems(), at = items.indexOf(document.activeElement);
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[e3.key];
    if (to === void 0 || !items.length) return;
    e3.preventDefault();
    items[(to + items.length) % items.length].focus();
  });
  $2("statusMenu").addEventListener("click", closeMenu);
  document.addEventListener("click", (e3) => {
    if (!$2("statusMenu").hidden && !e3.target.closest(".menuwrap")) closeMenu();
  });
  document.addEventListener("keydown", (e3) => {
    if (e3.key !== "Escape" || $2("statusMenu").hidden) return;
    const inside = $2("statusMenu").contains(document.activeElement);
    closeMenu();
    if (inside) $2("statusMore").focus();
  });
  $2("statusMore").closest(".menuwrap").addEventListener("focusout", () => setTimeout(() => {
    if (!$2("statusMenu").hidden && document.hasFocus() && !$2("statusMore").closest(".menuwrap").contains(document.activeElement)) closeMenu();
  }));
  var missed = false;
  function refreshStatus(c3) {
    const behind = document.documentElement.classList.contains("sheet-open");
    missed = behind;
    if (c3?.status && !behind) {
      statusData.set(c3.status);
      return;
    }
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
      const text2 = "My homelab needs a look. The report has every password and token removed.";
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Homelab report", text: text2 });
      } else {
        const a3 = $2("reportDownload");
        a3.href = URL.createObjectURL(file);
        a3.download = file.name;
        a3.click();
        if (r3.helper) location.href = "mailto:" + encodeURIComponent(r3.helper) + "?subject=" + encodeURIComponent("Homelab report") + "&body=" + encodeURIComponent(text2 + " The file is attached.");
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
    ] }) : due ? /* @__PURE__ */ u3("span", { class: "warn", children: "Prove the backups open, once a month" }) : (t3.lastSummary || (never(t3.lastTest) ? "Once there is a backup to test" : "Proven in the last 30 days")) + (timed ? ` · in ${tookText(timed.seconds)}` : "");
    const record2 = runs.slice(-6).reverse().map((r3) => `${dayText(new Date(r3.when), { day: "numeric", month: "short" })}: ${r3.passed ? "passed" : "failed"}${r3.seconds ? " in " + tookText(r3.seconds) : ""}`);
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
          value: copies.length ? /* @__PURE__ */ u3(S, { children: [
            String(fresh),
            /* @__PURE__ */ u3("small", { children: [
              " of ",
              copies.length - paused.length
            ] })
          ] }) : "None yet",
          sub: !copies.length ? "The first are made the night after an app with a database starts" : stale.length || paused.length ? /* @__PURE__ */ u3(S, { children: [
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
    const groups3 = copyGroups(o3);
    if (!groups3.length) return /* @__PURE__ */ u3("tr", { children: /* @__PURE__ */ u3("td", { colSpan: 4, class: "muted", children: "No installed app has a database to dump yet." }) });
    return /* @__PURE__ */ u3(S, { children: groups3.map((g2) => {
      const open2 = picked[g2.key] ?? (g2.key === "stale" || g2.key === "fresh");
      const toggle = () => setPicked({ ...picked, [g2.key]: !open2 });
      return [
        /* @__PURE__ */ u3("tr", { class: "grouphead fold copygroup " + g2.key + (g2.tone === "bad" ? " bad" : "") + (open2 ? " open" : ""), onClick: toggle, children: /* @__PURE__ */ u3("th", { colSpan: 4, children: [
          /* @__PURE__ */ u3("button", { type: "button", class: "foldbtn", "aria-expanded": open2, onClick: (e3) => {
            e3.stopPropagation();
            toggle();
          }, children: [
            /* @__PURE__ */ u3("span", { class: "chev", "aria-hidden": "true", children: open2 ? "▾" : "▸" }),
            g2.label
          ] }),
          /* @__PURE__ */ u3("span", { class: "n", children: String(g2.copies.length) }),
          !open2 && g2.note && /* @__PURE__ */ u3("span", { class: "names", children: g2.note })
        ] }) }, "g:" + g2.key),
        ...open2 ? g2.copies.map((c3) => /* @__PURE__ */ u3("tr", { class: "copy " + c3.state, children: [
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
            whenTitle: (never(j3.lastFinished) ? "Never ran" : "Last ran " + dateTimeText(new Date(j3.lastFinished))) + (never(j3.nextRun) ? "" : "\nNext run " + dateTimeText(new Date(j3.nextRun))),
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
    const clock = clockText(d3);
    const day3 = (x2) => new Date(x2.getFullYear(), x2.getMonth(), x2.getDate()).getTime();
    const days = Math.round((day3(now) - day3(d3)) / 864e5);
    if (days === 0) return `Today, ${clock}`;
    if (days === 1) return `Yesterday, ${clock}`;
    return dayText(d3, { weekday: "short", day: "numeric", month: "short" });
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
  function LogLines({ text: text2 }) {
    const lines = text2.replace(/\s+$/, "").split("\n");
    return /* @__PURE__ */ u3("pre", { class: "applog selectable", role: "log", tabIndex: 0, "aria-label": "Its log", children: lines.map((l3, i3) => {
      const tone = /\b(ERROR|FATAL|PANIC|CRIT(ICAL)?)\b|level=(error|fatal)/i.test(l3) ? "bad" : /\bWARN(ING)?\b|level=warn/i.test(l3) ? "warn" : "";
      return /* @__PURE__ */ u3("span", { class: tone ? "line " + tone : "line", children: l3 + "\n" }, i3);
    }) });
  }
  function Log({ explainer: explainer2, machine, dozzle, on }) {
    const [lines, setLines] = d2(200);
    const [text2, setText] = d2(null);
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
      text2 === null ? /* @__PURE__ */ u3("p", { class: "muted", children: "Reading its log…" }) : /* @__PURE__ */ u3(LogLines, { text: text2 }),
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
  function CopyButton({ text: text2, copy }) {
    const [said, setSaid] = d2("");
    return /* @__PURE__ */ u3("button", { class: "small", onClick: () => copy(text2).then((s3) => {
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
    const [tone, words2] = pending2 && !pending2.failed ? ["warn", doing2[pending2.action] || "Working…"] : p3.state;
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
              words2,
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
    const tested = o3 && !never(o3.restoreTest?.lastTest) ? `Restore test passed ${dayText(new Date(o3.restoreTest.lastTest), { day: "numeric", month: "short" })}` : "No restore test yet";
    return /* @__PURE__ */ u3("div", { class: "tiles facts", children: [
      /* @__PURE__ */ u3(
        Tile,
        {
          label: "Address",
          value: url ? /* @__PURE__ */ u3("a", { href: url, onClick: (e3) => {
            e3.preventDefault();
            on.open(url);
          }, children: /* @__PURE__ */ u3(Address, { text: url.replace(/^https?:\/\//, "") }) }) : /* @__PURE__ */ u3("span", { class: "muted", children: "None" }),
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
            disabled: busy || "updates" in switching2,
            on: updates,
            set: (v3) => on.setting("updates", v3),
            sub: updates ? "Every night, with a backup of its data first" : "Held: the nightly update leaves it out"
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
      out.push({ letter: dayText(d3, { weekday: "narrow" }), name: dayText(d3, { weekday: "long", day: "numeric", month: "short" }), weekday: dayText(d3, { weekday: "long" }), ok, all, today: i3 === 0 });
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
        signIn: (keys2) => appActions.signIn(a3, keys2),
        // The app's clipboard, or the browser's on a phone.
        copy: async (text2) => {
          if (window.runtime.ClipboardSetText) await window.runtime.ClipboardSetText(text2);
          else await navigator.clipboard.writeText(text2);
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

  // web/src/finances/logos.ts
  var brands = {
    "chase": { name: "Chase", bg: "#117ACA", ink: "#ffffff", kind: "bank", path: "M0 15.415c0 .468.38.85.848.85h5.937V.575L0 7.72v7.695m15.416 8.582c.467 0 .846-.38.846-.849v-5.937H.573l7.146 6.785h7.697M24 8.587a.844.844 0 0 0-.847-.846h-5.938V23.43l6.782-7.148L24 8.586M8.585.003a.847.847 0 0 0-.847.847v5.94h15.688L16.282.003H8.585Z" },
    "americanexpress": { name: "American Express", bg: "#2E77BC", ink: "#ffffff", kind: "card", path: "M16.015 14.378c0-.32-.135-.496-.344-.622-.21-.12-.464-.135-.81-.135h-1.543v2.82h.675v-1.027h.72c.24 0 .39.024.478.125.12.13.104.38.104.55v.35h.66v-.555c-.002-.25-.017-.376-.108-.516-.06-.08-.18-.18-.33-.234l.02-.008c.18-.072.48-.297.48-.747zm-.87.407l-.028-.002c-.09.053-.195.058-.33.058h-.81v-.63h.824c.12 0 .24 0 .33.05.098.048.156.147.15.255 0 .12-.045.215-.134.27zM20.297 15.837H19v.6h1.304c.676 0 1.05-.278 1.05-.884 0-.28-.066-.448-.187-.582-.153-.133-.392-.193-.73-.207l-.376-.015c-.104 0-.18 0-.255-.03-.09-.03-.15-.105-.15-.21 0-.09.017-.166.09-.21.083-.046.177-.066.272-.06h1.23v-.602h-1.35c-.704 0-.958.437-.958.84 0 .9.776.855 1.407.87.104 0 .18.015.225.06.046.03.082.106.082.18 0 .077-.035.15-.08.18-.06.053-.15.07-.277.07zM0 0v10.096L.81 8.22h1.75l.225.464V8.22h2.043l.45 1.02.437-1.013h6.502c.295 0 .56.057.756.236v-.23h1.787v.23c.307-.17.686-.23 1.12-.23h2.606l.24.466v-.466h1.918l.254.465v-.466h1.858v3.948H20.87l-.36-.6v.585h-2.353l-.256-.63h-.583l-.27.614h-1.213c-.48 0-.84-.104-1.08-.24v.24h-2.89v-.884c0-.12-.03-.12-.105-.135h-.105v1.036H6.067v-.48l-.21.48H4.69l-.202-.48v.465H2.235l-.256-.624H1.4l-.256.624H0V24h23.786v-7.108c-.27.135-.613.18-.973.18H21.09v-.255c-.21.165-.57.255-.914.255H14.71v-.9c0-.12-.018-.12-.12-.12h-.075v1.022h-1.8v-1.066c-.298.136-.643.15-.928.136h-.214v.915h-2.18l-.54-.617-.57.6H4.742v-3.93h3.61l.518.602.554-.6h2.412c.28 0 .74.03.942.225v-.24h2.177c.202 0 .644.045.903.225v-.24h3.265v.24c.163-.164.508-.24.803-.24h1.89v.24c.194-.15.464-.24.84-.24h1.176V0H0zM21.156 14.955c.004.005.006.012.01.016.01.01.024.01.032.02l-.042-.035zM23.828 13.082h.065v.555h-.065zM23.865 15.03v-.005c-.03-.025-.046-.048-.075-.07-.15-.153-.39-.215-.764-.225l-.36-.012c-.12 0-.194-.007-.27-.03-.09-.03-.15-.105-.15-.21 0-.09.03-.16.09-.204.076-.045.15-.05.27-.05h1.223v-.588h-1.283c-.69 0-.96.437-.96.84 0 .9.78.855 1.41.87.104 0 .18.015.224.06.046.03.076.106.076.18 0 .07-.034.138-.09.18-.045.056-.136.07-.27.07h-1.288v.605h1.287c.42 0 .734-.118.9-.36h.03c.09-.134.135-.3.135-.523 0-.24-.045-.39-.135-.526zM18.597 14.208v-.583h-2.235V16.458h2.235v-.585h-1.57v-.57h1.533v-.584h-1.532v-.51M13.51 8.787h.685V11.6h-.684zM13.126 9.543l-.007.006c0-.314-.13-.5-.34-.624-.217-.125-.47-.135-.81-.135H10.43v2.82h.674v-1.034h.72c.24 0 .39.03.487.12.122.136.107.378.107.548v.354h.677v-.553c0-.25-.016-.375-.11-.516-.09-.107-.202-.19-.33-.237.172-.07.472-.3.472-.75zm-.855.396h-.015c-.09.054-.195.056-.33.056H11.1v-.623h.825c.12 0 .24.004.33.05.09.04.15.128.15.25s-.047.22-.134.266zM15.92 9.373h.632v-.6h-.644c-.464 0-.804.105-1.02.33-.286.3-.362.69-.362 1.11 0 .512.123.833.36 1.074.232.238.645.31.97.31h.78l.255-.627h1.39l.262.627h1.36v-2.11l1.272 2.11h.95l.002.002V8.786h-.684v1.963l-1.18-1.96h-1.02V11.4L18.11 8.744h-1.004l-.943 2.22h-.3c-.177 0-.362-.03-.468-.134-.125-.15-.186-.36-.186-.662 0-.285.08-.51.194-.63.133-.135.272-.165.516-.165zm1.668-.108l.464 1.118v.002h-.93l.466-1.12zM2.38 10.97l.254.628H4V9.393l.972 2.205h.584l.973-2.202.015 2.202h.69v-2.81H6.118l-.807 1.904-.876-1.905H3.343v2.663L2.205 8.787h-.997L.01 11.597h.72l.26-.626h1.39zm-.688-1.705l.46 1.118-.003.002h-.915l.457-1.12zM11.856 13.62H9.714l-.85.923-.825-.922H5.346v2.82H8l.855-.932.824.93h1.302v-.94h.838c.6 0 1.17-.164 1.17-.945l-.006-.003c0-.78-.598-.93-1.128-.93zM7.67 15.853l-.014-.002H6.02v-.557h1.47v-.574H6.02v-.51H7.7l.733.82-.764.824zm2.642.33l-1.03-1.147 1.03-1.108v2.253zm1.553-1.258h-.885v-.717h.885c.24 0 .42.098.42.344 0 .243-.15.372-.42.372zM9.967 9.373v-.586H7.73V11.6h2.237v-.58H8.4v-.564h1.527V9.88H8.4v-.507" },
    "bankofamerica": { name: "Bank of America", bg: "#012169", ink: "#ffffff", kind: "bank", path: "M15.194 7.57c.487-.163 1.047-.307 1.534-.451-1.408-.596-3.176-1.227-4.764-1.625-.253.073-1.01.271-1.534.434.541.162 2.328.577 4.764 1.642zm-8.896 6.785c.577.343 1.19.812 1.786 1.209 3.952-3.068 7.85-5.432 12.127-6.767-.596-.307-1.119-.578-1.787-.902-2.562.65-6.947 2.4-12.126 6.46zm-.758-6.46c-2.112.974-4.331 2.31-5.54 3.085.433.199.866.361 1.461.65 2.671-1.805 4.764-2.905 5.594-3.266-.595-.217-1.154-.361-1.515-.47zm8.066.234c-.686-.379-3.068-1.263-4.71-1.642-.487.18-1.173.451-1.642.65.595.162 2.815.758 4.71 1.714.487-.235 1.173-.523 1.642-.722zm-3.374 1.552c-.56-.27-1.173-.523-1.643-.74-1.425.704-3.284 1.769-5.63 3.447.505.27 1.047.595 1.624.92 1.805-1.335 3.627-2.598 5.649-3.627zm1.732 8.825c3.79-3.249 9.113-6.407 12.036-7.544a48.018 48.018 0 00-1.949-1.155c-3.771 1.246-8.174 4.007-12.108 7.129.667.505 1.371 1.028 2.02 1.57zm2.851-.235h-.108l-.18-.27h-.109v.27h-.072v-.596h.27c.055 0 .109 0 .145.036.054.019.072.073.072.127 0 .108-.09.162-.198.162zm-.289-.343c.09 0 .199.018.199-.09 0-.072-.072-.09-.144-.09h-.163v.18zm-.523.036c0-.289.235-.523.541-.523.307 0 .542.234.542.523a.543.543 0 01-.542.542.532.532 0 01-.54-.542m.107 0c0 .235.199.433.451.433a.424.424 0 100-.848c-.27 0-.45.199-.45.415" },
    "wellsfargo": { name: "Wells Fargo", bg: "#D71E28", ink: "#ffffff", kind: "bank", path: "M12.136 13.949c0 .392-.245.616-.719.616h-.628v-1.226h.628c.48 0 .72.212.72.61zM6.922 15.06h1.044l-.523-1.443-.521 1.443zm12.46-1.82c-.72 0-1.109.562-1.109 1.526 0 .97.384 1.526 1.108 1.526.725 0 1.108-.556 1.108-1.526 0-.964-.389-1.526-1.108-1.526zM23.73 0v24H.269V0h23.462zm-5.548 10.652c.484.245.948.354 1.571.354.895 0 1.481-.458 1.481-1.171 0-.6-.357-1.014-1.028-1.172l-.677-.158c-.394-.092-.559-.25-.559-.517 0-.322.25-.523.74-.523s.778.18.89.604l.048.186h.383v-.943a2.927 2.927 0 0 0-1.352-.338c-.911 0-1.497.447-1.497 1.166 0 .556.34.965.996 1.112l.676.152c.432.099.592.273.592.562 0 .354-.261.55-.784.55-.59 0-.894-.24-1.027-.697l-.07-.235h-.383v1.068zm-3.378.245h3.02V9.595h-.383l-.043.19c-.106.486-.255.638-.607.638h-.74V7.557h.506v-.474h-1.753v.474h.453v2.866h-.453v.474zm-3.355 0h3.02V9.595h-.384l-.042.19c-.107.486-.256.638-.608.638h-.74V7.557h.506v-.474H11.45v.474h.452v2.866h-.452v.474zm-8.758-3.34.938 3.34h.74l.778-2.768.756 2.768h.74l.932-3.34h.736v2.866h-.453v.474h3.201V9.595h-.383l-.043.19c-.106.486-.26.638-.607.638h-.922V9.241h1.071a.58.58 0 0 0 .059-.273.55.55 0 0 0-.059-.26h-1.07v-1.15h.884c.357 0 .48.157.596.615l.038.147h.383V7.083H6.49v.474h.522l-.613 2.305-.762-2.779h-.766l-.746 2.774-.624-2.3h.501v-.474H2.266v.474h.426zm1.412 7.002v-1.22h.947c.358 0 .48.158.597.615l.038.147h.383v-1.236H2.857v.474h.453v2.866h-.453v.474h1.78v-.474h-.533v-1.112H5.2a.58.58 0 0 0 .058-.272.551.551 0 0 0-.058-.262H4.104zm9.114 1.913a.461.461 0 0 0-.048-.224.663.663 0 0 1-.112.011c-.245 0-.309-.142-.34-.458l-.022-.201c-.048-.43-.245-.708-.73-.746v-.017c.48-.022.975-.349.975-.964 0-.621-.496-1.008-1.257-1.008H9.542v.474h.453v2.866H9.26l-1.332-3.34H7.22l-1.305 3.34h-.373v.474h1.412v-.474h-.448l.245-.682h1.385l.245.682h-.437v.474h3.35v-.474h-.505v-1.16h.293c.586 0 .761.212.826.762l.02.19c.06.507.31.725.826.725.15 0 .299-.01.416-.027a.46.46 0 0 0 .048-.223zm3.633-1.788h-1.417a.52.52 0 0 0-.059.256c0 .11.016.18.059.268h.634v.964a1.598 1.598 0 0 1-.629.125c-.767 0-1.166-.56-1.166-1.53s.4-1.532 1.124-1.532c.485 0 .767.245.932.67l.058.153h.384v-.976a3.063 3.063 0 0 0-1.412-.337c-1.172 0-1.96.8-1.96 2.027 0 1.231.767 2.016 1.96 2.016.474 0 .964-.136 1.492-.404v-1.7zm4.512.082c0-1.182-.831-2.021-1.982-2.021-1.145 0-1.981.839-1.981 2.021 0 1.188.83 2.022 1.981 2.022 1.156 0 1.982-.834 1.982-2.022z" },
    "robinhood": { name: "Robinhood", bg: "#CCFF00", ink: "#111111", kind: "investment", path: "M2.84 24h.53c.096 0 .192-.048.224-.128C7.591 13.696 11.94 8.656 14.67 5.638c.112-.128.064-.225-.096-.225h-4.88a.55.55 0 0 0-.45.225L5.746 9.972c-.514.642-.642 1.236-.642 2.086v4.43c-1.14 3.194-1.862 5.361-2.392 7.32-.032.125.016.192.129.192M20.447.646c-.754-.802-4.157-.834-5.73-.224a3 3 0 0 0-.786.465 41 41 0 0 0-3.323 3.178c-.112.113-.064.225.097.225h5.409c.497 0 .786.289.786.786v6.1c0 .16.128.208.225.064l3.258-4.254c.53-.69.69-.898.835-1.861.192-1.413.08-3.58-.77-4.479m-6.982 16.18 2.231-3.676a.7.7 0 0 0 .064-.29V6.73c0-.16-.112-.225-.224-.097-3.355 3.74-5.971 7.672-8.395 12.407-.06.12.016.225.16.177l5.009-1.54c.565-.174.882-.402 1.155-.852" },
    "discover": { name: "Discover", bg: "#FF6000", ink: "#ffffff", kind: "card", path: "M14.58 12a2.023 2.023 0 1 1-2.025-2.023h.002c1.118 0 2.023.906 2.023 2.023zm-5.2-2.001c-1.124 0-2.025.884-2.025 1.99 0 1.118.878 1.984 2.007 1.984.319 0 .593-.063.93-.221v-.873c-.296.297-.559.416-.895.416-.747 0-1.277-.542-1.277-1.312 0-.73.547-1.306 1.243-1.306.354 0 .622.126.93.428v-.873a1.898 1.898 0 0 0-.913-.233zm-3.352 1.545c-.445-.165-.576-.273-.576-.479 0-.239.233-.422.553-.422.222 0 .405.091.598.308l.388-.508a1.665 1.665 0 0 0-1.117-.422c-.673 0-1.186.467-1.186 1.089 0 .524.239.792.936 1.043.291.103.438.171.513.217a.456.456 0 0 1 .222.394c0 .308-.245.536-.576.536-.354 0-.639-.177-.809-.507l-.479.461c.342.502.752.724 1.317.724.771 0 1.311-.513 1.311-1.249-.002-.603-.252-.876-1.095-1.185zM24 10.3a.29.29 0 0 1-.288.291.29.29 0 0 1-.291-.291v-.003A.29.29 0 1 1 24 10.3zm-.059.001a.235.235 0 0 0-.231-.239.234.234 0 0 0-.232.239c0 .132.104.239.232.239a.235.235 0 0 0 .231-.239zM3.472 13.887h.742v-3.803h-.742v3.803zm12.702-1.248l-1.014-2.554h-.81l1.614 3.9h.399l1.643-3.9h-.804l-1.028 2.554zm2.166 1.248h2.104v-.644h-1.362v-1.027h1.312v-.644h-1.312v-.844h1.362v-.644H18.34v3.803zm5.409-3.557l.11.138h-.097l-.094-.13v.13h-.08v-.334h.107c.081 0 .126.036.126.103.001.046-.025.08-.072.093zm-.006-.092c0-.029-.021-.043-.06-.043h-.014v.087h.014c.039 0 .06-.014.06-.044zm-1.228 2.047l1.197 1.602H22.8l-1.027-1.528h-.097v1.528h-.741v-3.803h1.1c.855 0 1.346.411 1.346 1.123 0 .583-.308.965-.866 1.078zm.103-1.038c0-.37-.251-.563-.713-.563h-.228v1.152h.217c.473-.001.724-.207.724-.589zm-19.487.742a1.91 1.91 0 0 1-.69 1.46c-.365.303-.781.439-1.357.439H.001v-3.803H1.09c1.202 0 2.041.781 2.041 1.904zm-.764-.006c0-.364-.154-.718-.411-.947-.245-.222-.536-.308-1.015-.308H.742v2.515h.199c.479 0 .782-.092 1.015-.302.256-.228.411-.593.411-.958z" },
    "mastercard": { name: "MasterCard", bg: "#EB001B", ink: "#ffffff", kind: "card", path: "M11.343 18.031c.058.049.12.098.181.146-1.177.783-2.59 1.238-4.107 1.238C3.32 19.416 0 16.096 0 12c0-4.095 3.32-7.416 7.416-7.416 1.518 0 2.931.456 4.105 1.238-.06.051-.12.098-.165.15C9.6 7.489 8.595 9.688 8.595 12c0 2.311 1.001 4.51 2.748 6.031zm5.241-13.447c-1.52 0-2.931.456-4.105 1.238.06.051.12.098.165.15C14.4 7.489 15.405 9.688 15.405 12c0 2.31-1.001 4.507-2.748 6.031-.058.049-.12.098-.181.146 1.177.783 2.588 1.238 4.107 1.238C20.68 19.416 24 16.096 24 12c0-4.094-3.32-7.416-7.416-7.416zM12 6.174c-.096.075-.189.15-.28.231C10.156 7.764 9.169 9.765 9.169 12c0 2.236.987 4.236 2.551 5.595.09.08.185.158.28.232.096-.074.189-.152.28-.232 1.563-1.359 2.551-3.359 2.551-5.595 0-2.235-.987-4.236-2.551-5.595-.09-.08-.184-.156-.28-.231z" },
    "visa": { name: "Visa", bg: "#1A1F71", ink: "#ffffff", kind: "card", path: "M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z" },
    "apple": { name: "Apple", bg: "#000000", ink: "#ffffff", kind: "card", path: "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" },
    "goldmansachs": { name: "Goldman Sachs", bg: "#7399C6", ink: "#ffffff", kind: "bank", path: "M1.963 9.264h1.452v2.378c-.484.098-.855.148-1.262.148C.561 11.79 0 10.878 0 9.377c0-1.614.778-2.526 2.329-2.526.196 0 .567.014 1.03.084v1.522h-.336l-.19-.582c-.183-.553-.4-.827-.744-.827-.596 0-.912.806-.912 2.315 0 1.515.126 2.23.904 2.23.106 0 .231-.014.351-.048V9.776l-.469-.323v-.189Zm1.424 6.382c0 .954-.651 1.501-1.802 1.501-.315 0-.778-.048-1.213-.119v-1.865h.337l.14.441c.315 1.017.54 1.353.94 1.353.421 0 .722-.371.722-.862 0-.399-.189-.68-.595-.898l-.702-.378c-.541-.287-.835-.736-.835-1.283 0-.828.68-1.326 1.796-1.326.252 0 .547.022 1.016.085v1.521h-.337l-.188-.581c-.19-.618-.393-.842-.764-.842-.415 0-.66.266-.66.652 0 .343.19.589.561.799l.708.399c.596.337.876.786.876 1.403Zm3.101 1.102.14.211v.106H5.556l-.05-.407c-.112.308-.407.491-.786.491-.561 0-.912-.351-.912-.926 0-.561.315-.933 1.283-1.311l.414-.161v-.525c0-.463-.085-.652-.344-.652-.21 0-.329.112-.533.623l-.231.573h-.315v-1.144c.414-.126.828-.21 1.185-.21.792 0 1.221.378 1.221 1.066v2.266Zm.405-6.824c0 1.192-.637 1.866-1.459 1.866-.82 0-1.457-.674-1.457-1.866 0-1.193.637-1.866 1.459-1.866.82 0 1.457.673 1.457 1.866Zm-1.387 6.235v-1.213l-.133.056c-.414.169-.569.547-.569 1.101 0 .414.099.652.329.652.231 0 .373-.225.373-.596Zm.357-6.235c0-1.347-.112-1.704-.427-1.704s-.428.357-.428 1.704c0 1.346.113 1.704.428 1.704s.427-.358.427-1.704Zm3.521 6.269.126.064c-.224.646-.511.89-1.066.89-.904 0-1.409-.679-1.409-1.865 0-1.185.589-1.866 1.55-1.866.258 0 .603.042.897.16v1.193h-.329l-.132-.449c-.176-.596-.273-.75-.449-.75-.281 0-.505.365-.505 1.754 0 1.114.168 1.521.595 1.521.287.001.532-.181.722-.652Zm-.779-4.488H7.342v-.104l.141-.211V7.476l-.141-.21V7.16l1.123-.084v4.313l.14.211v.105Zm1.726.085c-.772 0-1.235-.702-1.235-1.901 0-1.192.483-1.83 1.227-1.83.379 0 .589.147.68.441V7.476l-.141-.21V7.16l1.123-.084v4.313l.14.211v.104h-.996l-.077-.533c-.111.457-.321.619-.721.619Zm2.461 4.958.14.211v.106H11.67v-.106l.14-.211v-2.525c0-.301-.091-.483-.309-.483-.26 0-.449.218-.449.645v2.363l.141.211v.106H9.93v-.106l.14-.211v-3.914l-.14-.21v-.105l1.122-.084v1.451c.127-.301.414-.469.82-.469.576 0 .919.365.919 1.073v2.258h.001Zm-2.664-6.846c0 1.263.112 1.648.421 1.648.385 0 .455-.554.455-1.662 0-1.073-.077-1.606-.449-1.606-.315 0-.427.379-.427 1.62Zm7.041 1.487.14.211v.104h-1.262V11.6l.14-.211V8.787c0-.252-.084-.407-.281-.407-.244 0-.441.219-.441.638v2.371l.14.211v.104h-1.262V11.6l.14-.211V8.787c0-.252-.084-.407-.28-.407-.245 0-.442.219-.442.638v2.371l.141.211v.104h-1.263V11.6l.14-.211V8.535l-.14-.169v-.104l1.01-.12h.084l.028.393c.119-.309.414-.477.814-.477.427 0 .708.21.834.589.105-.365.435-.589.856-.589.553 0 .904.365.904 1.072v2.259Zm-1.311 4.644c0 .609-.393 1.114-1.339 1.114-.245 0-.575-.028-1.087-.119v-1.304h.287l.091.281c.224.715.441.982.785.982.323 0 .533-.232.533-.59 0-.294-.147-.497-.497-.687l-.603-.323c-.385-.21-.596-.539-.596-.946 0-.638.499-1.024 1.325-1.024.239 0 .547.034.884.105v1.024h-.287l-.148-.373c-.168-.449-.329-.595-.595-.595-.287 0-.456.168-.456.449 0 .238.141.399.484.595l.595.337c.406.232.624.561.624 1.074Zm4.538-4.644.14.211v.104h-1.073l-.048-.407c-.112.309-.407.491-.786.491-.561 0-.911-.35-.911-.926 0-.561.315-.932 1.283-1.311l.413-.16v-.526c0-.463-.084-.652-.343-.652-.211 0-.329.113-.533.624l-.231.575h-.317V8.27c.415-.127.828-.211 1.185-.211.792 0 1.221.379 1.221 1.066v2.264Zm-.982-.589V9.587l-.133.056c-.413.168-.567.547-.567 1.101 0 .414.098.653.329.653.23 0 .371-.225.371-.597Zm4.586.8v.104h-1.263V11.6l.141-.211V8.864c0-.302-.091-.484-.309-.484-.26 0-.449.219-.449.646v2.363l.14.211v.104h-1.262V11.6l.14-.211V8.535l-.14-.169v-.104l1.01-.12h.084l.028.393c.119-.309.407-.477.82-.477.575 0 .918.365.918 1.072v2.259L24 11.6Z" },
    "paypal": { name: "PayPal", bg: "#002991", ink: "#ffffff", kind: "bank", path: "M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z" },
    "venmo": { name: "Venmo", bg: "#008CFF", ink: "#ffffff", kind: "bank", path: "M21.772 13.119c-.267 0-.381-.251-.38-.655 0-.533.121-1.575.712-1.575.267 0 .357.243.357.598 0 .533-.13 1.632-.689 1.632Zm.502-3.377c-1.677 0-2.405 1.285-2.405 2.658 0 1.042.421 1.874 1.693 1.874 1.717 0 2.438-1.406 2.438-2.763 0-1.025-.462-1.769-1.726-1.769Zm-3.833 0c-.558 0-.964.17-1.393.477-.154-.275-.462-.477-.932-.477-.542 0-.947.219-1.247.437l-.04-.364H13.54l-.688 4.354h1.506l.479-3.053c.129-.065.323-.154.518-.154.145 0 .267.049.267.267 0 .056-.016.145-.024.218l-.429 2.722h1.498l.478-3.053c.138-.073.324-.154.51-.154.146 0 .268.049.268.267 0 .056-.017.145-.025.218l-.429 2.722h1.499l.461-2.908c.025-.153.049-.388.049-.549 0-.582-.267-.97-1.037-.97Zm-6.871 0c-.575 0-.98.219-1.287.421l-.017-.348H8.962l-.689 4.354H9.78l.478-3.053c.13-.065.324-.154.518-.154.147 0 .268.049.268.242 0 .081-.024.227-.032.299l-.422 2.666h1.499l.462-2.908c.024-.153.049-.388.049-.549 0-.582-.268-.97-1.03-.97Zm-5.631 1.834c.041-.485.413-.824.697-.824.162 0 .299.097.299.291 0 .404-.713.533-.996.533Zm.843-1.834c-1.604 0-2.382 1.39-2.382 2.698 0 1.01.478 1.817 1.814 1.817.527 0 1.07-.113 1.418-.282l.186-1.26c-.494.25-.874.347-1.271.347-.365 0-.64-.194-.64-.687.826-.008 2.252-.347 2.252-1.453 0-.687-.494-1.18-1.377-1.18Zm-4.239.267c.089.186.146.412.146.743 0 .606-.429 1.494-.777 2.06l-.373-2.989L0 9.969l.705 4.2h1.757c.77-1.01 1.718-2.448 1.718-3.554 0-.347-.073-.622-.235-.889l-1.402.283Z" },
    "cashapp": { name: "Cash App", bg: "#00C244", ink: "#111111", kind: "bank", path: "M23.59 3.475a5.1 5.1 0 00-3.05-3.05c-1.31-.42-2.5-.42-4.92-.42H8.36c-2.4 0-3.61 0-4.9.4a5.1 5.1 0 00-3.05 3.06C0 4.765 0 5.965 0 8.365v7.27c0 2.41 0 3.6.4 4.9a5.1 5.1 0 003.05 3.05c1.3.41 2.5.41 4.9.41h7.28c2.41 0 3.61 0 4.9-.4a5.1 5.1 0 003.06-3.06c.41-1.3.41-2.5.41-4.9v-7.25c0-2.41 0-3.61-.41-4.91zm-6.17 4.63l-.93.93a.5.5 0 01-.67.01 5 5 0 00-3.22-1.18c-.97 0-1.94.32-1.94 1.21 0 .9 1.04 1.2 2.24 1.65 2.1.7 3.84 1.58 3.84 3.64 0 2.24-1.74 3.78-4.58 3.95l-.26 1.2a.49.49 0 01-.48.39H9.63l-.09-.01a.5.5 0 01-.38-.59l.28-1.27a6.54 6.54 0 01-2.88-1.57v-.01a.48.48 0 010-.68l1-.97a.49.49 0 01.67 0c.91.86 2.13 1.34 3.39 1.32 1.3 0 2.17-.55 2.17-1.42 0-.87-.88-1.1-2.54-1.72-1.76-.63-3.43-1.52-3.43-3.6 0-2.42 2.01-3.6 4.39-3.71l.25-1.23a.48.48 0 01.48-.38h1.78l.1.01c.26.06.43.31.37.57l-.27 1.37c.9.3 1.75.77 2.48 1.39l.02.02c.19.2.19.5 0 .68z" },
    "coinbase": { name: "Coinbase", bg: "#0052FF", ink: "#ffffff", kind: "investment", path: "M4.844 11.053c-.872 0-1.553.662-1.553 1.548s.664 1.542 1.553 1.542c.889 0 1.564-.667 1.564-1.547 0-.875-.664-1.543-1.564-1.543zm.006 2.452c-.497 0-.86-.386-.86-.904 0-.523.357-.909.854-.909.502 0 .866.392.866.91 0 .517-.364.903-.86.903zm1.749-1.778h.433v2.36h.693V11.11H6.599zm-5.052-.035c.364 0 .653.224.762.558h.734c-.133-.713-.722-1.197-1.49-1.197-.872 0-1.553.662-1.553 1.548 0 .887.664 1.543 1.553 1.543.75 0 1.351-.484 1.484-1.203h-.728a.78.78 0 01-.756.564c-.502 0-.855-.386-.855-.904 0-.523.347-.909.85-.909zm18.215.622l-.508-.075c-.242-.035-.415-.115-.415-.305 0-.207.225-.31.53-.31.336 0 .55.143.595.379h.67c-.075-.599-.537-.95-1.247-.95-.733 0-1.218.375-1.218.904 0 .506.317.8.958.892l.508.075c.249.034.387.132.387.316 0 .236-.242.334-.577.334-.41 0-.641-.167-.676-.42h-.681c.064.581.52.99 1.35.99.757 0 1.26-.346 1.26-.938 0-.53-.364-.806-.936-.892zM7.378 9.885a.429.429 0 00-.444.437c0 .254.19.438.444.438a.429.429 0 00.445-.438.429.429 0 00-.445-.437zm10.167 2.245c0-.645-.392-1.076-1.224-1.076-.785 0-1.224.397-1.31 1.007h.687c.035-.236.22-.432.612-.432.352 0 .525.155.525.345 0 .248-.317.311-.71.351-.531.058-1.19.242-1.19.933 0 .535.4.88 1.034.88.497 0 .809-.207.965-.535.023.293.242.483.548.483h.404v-.616h-.34v-1.34zm-.68.748c0 .397-.347.69-.769.69-.26 0-.48-.11-.48-.34 0-.293.353-.373.676-.408.312-.028.485-.097.572-.23zm-3.679-1.825c-.386 0-.71.162-.94.432V9.856h-.693v4.23h.68v-.391c.232.282.56.449.953.449.832 0 1.461-.656 1.461-1.543 0-.886-.64-1.548-1.46-1.548zm-.103 2.452c-.497 0-.86-.386-.86-.904 0-.517.369-.909.865-.909.503 0 .855.386.855.91 0 .517-.364.903-.86.903zm-3.187-2.452c-.45 0-.745.184-.919.443v-.385H8.29v2.975h.693v-1.617c0-.455.289-.777.716-.777.398 0 .647.282.647.69v1.704h.692v-1.755c0-.748-.386-1.278-1.142-1.278zM24 12.503c0-.851-.624-1.45-1.46-1.45-.89 0-1.542.668-1.542 1.548 0 .927.698 1.543 1.553 1.543.722 0 1.287-.426 1.432-1.03h-.722c-.104.264-.358.414-.699.414-.445 0-.78-.276-.854-.76H24v-.264zm-2.252-.23c.11-.414.422-.615.78-.615.392 0 .693.224.762.615Z" },
    "binance": { name: "Binance", bg: "#F0B90B", ink: "#111111", kind: "investment", path: "M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7154 2.7164L18.5682 12l2.6924-2.7164zm-9.272.001l2.7163 2.6914-2.7164 2.7174v-.001L9.2721 12l2.7164-2.7154zm-9.2722-.001L5.4088 12l-2.6914 2.6924L0 12l2.7164-2.7164zM11.9885.0115l7.353 7.329-2.7174 2.7154-4.6356-4.6356-4.6355 4.6595-2.7174-2.7154 7.353-7.353z" },
    "revolut": { name: "Revolut", bg: "#191C1F", ink: "#ffffff", kind: "bank", path: "M20.9133 6.9566C20.9133 3.1208 17.7898 0 13.9503 0H2.424v3.8605h10.9782c1.7376 0 3.177 1.3651 3.2087 3.043.016.84-.2994 1.633-.8878 2.2324-.5886.5998-1.375.9303-2.2144.9303H9.2322a.2756.2756 0 0 0-.2755.2752v3.431c0 .0585.018.1142.052.1612L16.2646 24h5.3114l-7.2727-10.094c3.6625-.1838 6.61-3.2612 6.61-6.9494zM6.8943 5.9229H2.424V24h4.4704z" },
    "wise": { name: "Wise", bg: "#9FE870", ink: "#111111", kind: "bank", path: "M6.488 7.469 0 15.05h11.585l1.301-3.576H7.922l3.033-3.507.01-.092L8.993 4.48h8.873l-6.878 18.925h4.706L24 .595H2.543l3.945 6.874Z" },
    "monzo": { name: "Monzo", bg: "#14233C", ink: "#ffffff", kind: "bank", path: "M4.244 1.174a.443.443 0 00-.271.13l-3.97 3.97-.001.001c3.884 3.882 8.093 8.092 11.748 11.748v-8.57L4.602 1.305a.443.443 0 00-.358-.131zm15.483 0a.443.443 0 00-.329.13L12.25 8.456v8.568L24 5.275c-1.316-1.322-2.647-2.648-3.97-3.97a.443.443 0 00-.301-.131zM0 5.979l.002 10.955c0 .294.118.577.326.785l4.973 4.976c.28.282.76.083.758-.314V12.037zm23.998.003l-6.06 6.061v10.338c-.004.399.48.6.76.314l4.974-4.976c.208-.208.326-.49.326-.785z" },
    "starlingbank": { name: "Starling Bank", bg: "#6935D3", ink: "#ffffff", kind: "bank", path: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm2.738 3.822h.666v2.724h-.666a4.794 4.794 0 0 0-4.789 4.788V12H7.226v-.666c0-4.142 3.37-7.512 7.512-7.512zM14.05 12h2.723v.666c0 4.142-3.37 7.512-7.512 7.512h-.666v-2.724h.666a4.794 4.794 0 0 0 4.789-4.788z" },
    "n26": { name: "N26", bg: "#48AC98", ink: "#111111", kind: "bank", path: "M0 3.803v1.195h7.436V3.803H0zM12.69 7.29c-2.034 0-3.038 1.252-3.038 2.684 0 .234.027.468.092.728l1.393.135a3.697 3.697 0 0 1-.09-.793c0-1.072.71-1.586 1.598-1.586.866 0 1.507.485 1.507 1.652 0 1.186-.58 1.995-1.464 2.88-.925.923-2.4 2.027-3.112 2.534v1.092h6.135v-1.195h-4.168c.695-.48 1.69-1.279 2.133-1.72.502-.503 1.931-1.794 1.931-3.636 0-1.903-1.24-2.775-2.918-2.775zm8.34 0c-1.976 0-3.454 1.517-3.454 4.916 0 3.017 1.233 4.508 3.356 4.508 1.754 0 3.068-1.198 3.068-3.172 0-1.542-.823-3.066-2.793-3.066-1.1 0-1.884.51-2.281 1.263 0-1.78.62-3.33 2.094-3.33.937 0 1.309.538 1.507 1.422l1.366-.271c-.321-1.527-1.292-2.27-2.864-2.27zM.075 7.389v9.228h1.33v-6.312c0-.56-.013-.898-.039-1.223h.026c.136.372.298.699.539 1.123l3.732 6.412h1.69V7.39H6.04v6.31c0 .56.013.898.04 1.223h-.028a7.252 7.252 0 0 0-.537-1.123L1.783 7.389H.076zm20.817 4.185c1.114 0 1.744.822 1.744 1.992 0 1.256-.717 2.034-1.701 2.034-1.09 0-1.843-1.001-1.973-2.329.33-1.133 1.063-1.697 1.93-1.697zM0 19.008v1.19h7.436v-1.19H0z" },
    "bunq": { name: "bunq", bg: "#3394D7", ink: "#ffffff", kind: "bank", path: "M16.414 14.62h1.103v-2.896a2.484 2.484 0 0 0-2.483-2.483 2.484 2.484 0 0 0-2.482 2.483v2.897h1.103v-2.897c0-.837.618-1.517 1.38-1.517.76 0 1.379.68 1.379 1.517zm-6.07-5.24h1.104v2.896a2.484 2.484 0 0 1-2.482 2.483 2.484 2.484 0 0 1-2.483-2.483V9.379h1.103v2.897c0 .837.618 1.517 1.38 1.517.76 0 1.379-.68 1.379-1.517zM0 7.034V12c0 .046.001.093.004.139H0v2.482h.965l.055-.48A2.76 2.76 0 0 0 5.518 12a2.76 2.76 0 0 0-4.414-2.208V7.035zm2.69 3.172c.951 0 1.724.803 1.724 1.793 0 .99-.773 1.793-1.725 1.793-.951 0-1.724-.803-1.724-1.793 0-.99.773-1.793 1.724-1.793zm18.552-.965A2.76 2.76 0 0 0 18.482 12a2.76 2.76 0 0 0 4.414 2.207v2.758H24V12a2.15 2.15 0 0 0-.004-.139H24V9.38h-.965l-.055.48a2.741 2.741 0 0 0-1.738-.617zm.069.965c.951 0 1.724.803 1.724 1.793 0 .99-.773 1.793-1.724 1.793-.952 0-1.725-.803-1.725-1.793 0-.99.773-1.793 1.725-1.793Z" },
    "nubank": { name: "Nubank", bg: "#820AD1", ink: "#ffffff", kind: "bank", path: "M7.2795 5.4336c-1.1815 0-2.1846.4628-2.9432 1.252h-.002c-.0541-.0022-.1074-.002-.162-.002-1.5436 0-2.9925.8835-3.699 2.2559-.3088.5996-.4234 1.2442-.459 1.9003-.0321.589 0 1.1863 0 1.7696v5.6523H3.184s.0022-2.784 0-5.1777c-.0014-1.6112-.0118-3.0471 0-3.3418.056-1.3937.4372-2.3053 1.1484-3.0508 2.3585.0018 3.8852 1.6091 3.9705 4.168.0196.5874.0254 3.7304.0254 3.7304v3.672h3.1678v-4.965c0-1.5007.0127-2.8006-.0918-3.6952-.292-2.5-1.821-4.168-4.1248-4.168zm8.3903.3008l-3.166.0039v4.9648c0 1.5009-.0127 2.8007.0919 3.6953.2921 2.5001 1.821 4.168 4.1248 4.168 1.1815 0 2.1846-.4628 2.9432-1.252.0003-.0003.0016.0004.002 0 .0542.0023.1093.002.164.002 1.5435 0 2.9905-.8835 3.6971-2.2558.3088-.5997.4233-1.2442.459-1.9004.032-.5889 0-1.1862 0-1.7695V5.7383H20.816s-.0022 2.784 0 5.1777c.0015 1.6113.0119 3.047 0 3.3418-.056 1.3935-.4372 2.3053-1.1483 3.0508-2.3586-.0018-3.8853-1.6091-3.9706-4.168-.0196-.5874-.0273-2.0437-.0273-3.7324Z" },
    "hsbc": { name: "HSBC", bg: "#DB0011", ink: "#ffffff", kind: "bank", path: "m24 12.007-5.996 5.997V5.996L24 12.007zm-5.996-6.01H6.01l5.996 6.01 5.997-6.01zM0 12.006l6.01 5.997V5.996L0 12.007zm6.01 5.997h11.994l-5.997-5.997-5.996 5.997z" },
    "barclays": { name: "Barclays", bg: "#00AEEF", ink: "#111111", kind: "bank", path: "M21.043 3.629a3.235 3.235 0 0 0-1.048-.54 3.076 3.076 0 0 0-.937-.144h-.046c-.413.006-1.184.105-1.701.71a1.138 1.138 0 0 0-.226 1.023.9.9 0 0 0 .555.63s.088.032.228.058c-.04.078-.136.214-.136.214-.179.265-.576.612-1.668.612h-.063c-.578-.038-1.056-.189-1.616-.915-.347-.45-.523-1.207-.549-2.452-.022-.624-.107-1.165-.256-1.6-.1-.29-.333-.596-.557-.742a2.55 2.55 0 0 0-.694-.336c-.373-.12-.848-.14-1.204-.146-.462-.01-.717.096-.878.292-.027.033-.032.05-.068.046-.084-.006-.272-.006-.328-.006-.264 0-.498.043-.721.09-.47.1-.761.295-1.019.503-.12.095-.347.365-.399.653a.76.76 0 0 0 .097.578c.14-.148.374-.264.816-.266.493-.002 1.169.224 1.406.608.336.547.27.99.199 1.517-.183 1.347-.68 2.048-1.783 2.203-.191.026-.38.04-.56.04-.776 0-1.34-.248-1.63-.716a.71.71 0 0 1-.088-.168s.087-.021.163-.056c.294-.14.514-.344.594-.661.09-.353.004-.728-.23-1.007-.415-.47-.991-.708-1.713-.708-.4 0-.755.076-.982.14-.908.256-1.633.947-2.214 2.112-.412.824-.7 1.912-.81 3.067-.11 1.13-.056 2.085.019 2.949.124 1.437.363 2.298.708 3.22a15.68 15.68 0 0 0 1.609 3.19c.09-.094.15-.161.308-.318.188-.19.724-.893.876-1.11.19-.27.51-.779.664-1.147l.15.119c.16.127.252.348.249.592-.003.215-.053.464-.184.922a8.703 8.703 0 0 1-.784 1.818c-.189.341-.27.508-.199.584.015.015.038.03.06.026.116 0 .34-.117.585-.304.222-.17.813-.672 1.527-1.675a15.449 15.449 0 0 0 1.452-2.521c.12.046.255.101.317.226a.92.92 0 0 1 .08.563c-.065.539-.379 1.353-.63 1.94-.425.998-1.208 2.115-1.788 2.877-.022.03-.163.197-.186.227.9.792 1.944 1.555 3.007 2.136.725.408 2.203 1.162 3.183 1.424.98-.262 2.458-1.016 3.184-1.424a17.063 17.063 0 0 0 3.003-2.134c-.05-.076-.13-.158-.183-.23-.582-.763-1.365-1.881-1.79-2.875-.25-.59-.563-1.405-.628-1.94-.028-.221-.002-.417.08-.565.033-.098.274-.218.317-.226.405.884.887 1.73 1.452 2.522.715 1.003 1.306 1.506 1.527 1.674.248.191.467.304.586.304a.07.07 0 0 0 .044-.012c.094-.069.017-.234-.183-.594a9.003 9.003 0 0 1-.786-1.822c-.13-.456-.18-.706-.182-.92-.004-.246.088-.466.248-.594l.15-.118c.155.373.5.919.665 1.147.15.216.685.919.876 1.11.156.158.22.222.308.32a15.672 15.672 0 0 0 1.609-3.19c.343-.923.583-1.784.707-3.222.075-.86.128-1.81.02-2.948-.101-1.116-.404-2.264-.81-3.068-.249-.49-.605-1.112-1.171-1.566z" },
    "deutschebank": { name: "Deutsche Bank", bg: "#0018A8", ink: "#ffffff", kind: "bank", path: "M3.375 3.375v17.25h17.25V3.375H3.375zM0 0h24v24H0V0zm5.25 18.225 9.15-12.45h4.35L9.6 18.225H5.25z" },
    "commerzbank": { name: "Commerzbank", bg: "#FFCC33", ink: "#111111", kind: "bank", path: "M6.277 1.538a.018.018 0 0 0-.012.007l-4.74 8.21-1.398 2.418c.446.774.794 1.353 1.22 2.09.671 1.164 1.548 1.597 3.13 1.889a12.9 12.9 0 0 1 .697-1.392l2.783-4.824 2.786-4.826c.404-.702 1.296-2.143 2.57-2.965-.04.025-.07.059-.109.085.07-.047.137-.094.209-.136.46-.278.98-.467 1.413-.515.339-.038 1.465-.041 2.74-.041zm11.59.505c-1.048-.008-1.462.007-2.545.008-1.39 0-2.381.887-3.083 1.773.372.493.68.971.863 1.288a13357.605 13357.605 0 0 0 5.571 9.648c.404.7 1.209 2.196 1.284 3.71.029.574-.079 1.165-.265 1.592-.131.3-.652 1.207-1.256 2.253L24 12.678v-.008a.013.013 0 0 0-.002-.005zM.001 8.163l.095 4.946L0 8.163zm.093 4.946 1.132 1.964 4.264 7.384a.015.015 0 0 0 .012.005h12.265c.446-.779.664-1.147 1.311-2.282.709-1.242.278-2.681-.037-3.472-.618.076-1.18.093-1.547.093H6.35c-.809 0-2.505-.05-3.853-.741-.513-.263-.972-.65-1.248-1.027-.176-.238-.625-1.003-1.156-1.924z" },
    "caixabank": { name: "CaixaBank", bg: "#007EAE", ink: "#ffffff", kind: "bank", path: "M4.938 16c.183 0 .315.13.487.1.239.09.212.383.462.455.19.384.312.797.419 1.21-.077.244.129.384.056.608l.072.04a1.8 1.8 0 0 1-.114.716c.038.426-.17.78-.353 1.14-.13.083-.19.314-.372.273-.323.102-.353.584-.748.524-.25.189-.596.083-.895.09-.176-.09-.419-.067-.536-.22a3.3 3.3 0 0 1-.84-.57c-.102-.22-.333-.318-.363-.57.09-.302-.1-.576-.02-.88l-.06-.504.19-.87c.326-.171.235-.561.558-.683.2-.467.683-.566 1.059-.797.14-.03.311.05.422-.08.205-.03.394.179.577.018m1.496-3.682c.202.14.19.422.372.566l.092.622-.456.669c-.573.303-1.431.433-1.967-.054-.304-.269-.383-.664-.304-1.059l.213-.573c.122-.084.28-.103.365-.243.28-.182.645-.14.967-.213.244.08.607-.05.718.282zm14.967-9.766c-.084 1.424-1.253 2.38-1.868 3.584-.266.714-.89 1.14-1.33 1.784-.405.418-.796.87-1.134 1.334.06.333.418.424.618.667.456.27.502.786.896 1.102.232 0 .232.341.487.3.535.577.967 1.173 1.412 1.795a1.3 1.3 0 0 0 .37.607c.355.514.647 1.064 1.01 1.584.055.585.549.979.7 1.526.22.292.312.635.513.926.316.684.524 1.406.9 2.062.069.152-.023.3-.103.41-.14.114-.25-.091-.414-.06a14 14 0 0 1-2.38-1.2c-.79-.638-1.656-1.09-2.43-1.758-.304-.076-.428-.433-.71-.574-.747-.462-1.344-1.131-2.1-1.563-.341-.266-.683-.518-1.028-.79-.266-.027-.354-.331-.607-.422-.563-.342-1.08-.82-1.656-1.14-.05.077 0 .203-.05.282-.383.373-.28.949-.554 1.364-.01.595-.425 1.028-.596 1.556-.475.846-.888 1.712-1.382 2.55-.657.87-1.01 1.919-1.937 2.614-.205.253-.436.383-.686.546-.114-.03-.274-.012-.304-.152-.114-.212.03-.532-.121-.725.132-.297.05-.627.113-.95l-.053-.14c.01-.444.23-.82.14-1.272a3 3 0 0 0 .206-.91 5 5 0 0 0 .303-1.212 1.5 1.5 0 0 0 .153-.836c.098-.265.117-.576.39-.77.039-.17 0-.342.03-.524.27-.827.608-1.625.817-2.471 0-.061-.06-.08-.103-.092-.596-.03-1.15.092-1.705-.06a14 14 0 0 1-2.695-.311c-.348-.07-.774-.027-1.097-.23-.209.009-.452.05-.653-.063-.418-.2-.919-.167-1.329-.391-.315.038-.54-.16-.82-.19-.274.019-.425-.212-.615-.364v-.092c.5-.683 1.31-.876 2.038-1.139.714-.224 1.511-.243 2.26-.395.475-.08.987.05 1.465-.03.858.02 1.682.16 2.532.182.282.038.544.172.828.16l-.01-.122-.8-1.09c-.302-.705-.857-1.302-1.046-2.05-.182-.219-.012-.553-.152-.796-.011-.11.075-.19.13-.282.17-.068.363.05.535-.06.515.12.986.303 1.503.405.53.21 1.078.422 1.556.776.593.425 1.31.698 1.773 1.351.125.114.316.133.475.091.14-.019.17-.19.303-.243.627-.39 1.334-.615 1.948-1.048.255-.25.657-.28.81-.627.189-.09.36-.212.565-.265.353-.247.707-.52 1.09-.72a1.1 1.1 0 0 0 .515-.244c.627-.342 1.284-.627 1.88-1.02.13-.355.524-.27.805-.355.14.034.334.012.395.19z" },
    "axisbank": { name: "Axis Bank", bg: "#971A4D", ink: "#ffffff", kind: "bank", path: "M11.978 1.596 0 22.404h7.453l8.265-14.369Zm.027 12.896 4.533 7.903H24l-4.533-7.903z" },
    "hdfcbank": { name: "HDFC Bank", bg: "#004B8D", ink: "#ffffff", kind: "bank", path: "M.572 0v10.842h3.712V4.485h6.381V0Zm12.413 0v4.485h6.383v6.357h4.06V0Zm-4.64 8.53v6.938h6.963V8.53ZM.572 13.153V24h10.093v-4.486h-6.38v-6.361zm18.796 0v6.361h-6.383V24h10.443V13.153Z" },
    "icicibank": { name: "ICICI Bank", bg: "#AE282E", ink: "#ffffff", kind: "bank", path: "M21.9258 2.0961C19.279-1.6476 12.698-.2426 7.2138 5.2416c-5.484 5.475-7.7865 12.9625-5.1397 16.7062.8728 1.2386 2.1837 1.902 3.7386 2.0522 1.0516.0078 1.9129-1.1846 2.6158-2.7774.7252-1.6678 1.1694-3.218 1.5138-4.6592.5077-2.2934.544-3.934.29-4.2786-.435-.5801-1.4321-.435-2.5561.2176-.544.2991-1.26.0997-.408-.9336.8612-1.0425 4.2605-3.5625 5.4933-3.9523 1.3415-.3898 2.8734.136 2.3568 1.6226-.3706 1.0847-5.0473 13.486-1.596 12.2719 1.1049-.747 2.205-1.6497 3.2639-2.7086 5.4841-5.475 7.7865-12.9625 5.1396-16.7063zm-5.3662 3.209c-1.0969 1.0968-2.52 1.4865-3.1364.852-.6617-.6345-.272-2.0577.8249-3.1726 1.1058-1.115 2.529-1.4594 3.1454-.834.6345.6436.2448 2.0487-.834 3.1545z" },
    "klarna": { name: "Klarna", bg: "#FFB3C7", ink: "#111111", kind: "", path: "M4.592 2v20H0V2h4.592zm11.46 0c0 4.194-1.583 8.105-4.415 11.068l-.278.283L17.702 22h-5.668l-6.893-9.4 1.779-1.332c2.858-2.14 4.535-5.378 4.637-8.924L11.562 2h4.49zM21.5 17a2.5 2.5 0 110 5 2.5 2.5 0 010-5z" },
    "netflix": { name: "Netflix", bg: "#E50914", ink: "#ffffff", kind: "", path: "m5.398 0 8.348 23.602c2.346.059 4.856.398 4.856.398L10.113 0H5.398zm8.489 0v9.172l4.715 13.33V0h-4.715zM5.398 1.5V24c1.873-.225 2.81-.312 4.715-.398V14.83L5.398 1.5z" },
    "spotify": { name: "Spotify", bg: "#1ED760", ink: "#111111", kind: "", path: "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" },
    "youtube": { name: "YouTube", bg: "#FF0000", ink: "#ffffff", kind: "", path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
    "max": { name: "Max", bg: "#525252", ink: "#ffffff", kind: "", path: "M1.769 0A1.77 1.77 0 0 0 0 1.769V22.23A1.77 1.77 0 0 0 1.769 24H22.23A1.77 1.77 0 0 0 24 22.231V1.77A1.77 1.77 0 0 0 22.231 0zm12.485 3.28a4.301 4.301 0 0 1 4.3 4.302 4.301 4.301 0 0 1-1.993 3.63 6.085 6.085 0 0 1 1.054 3.422 6.085 6.085 0 0 1-6.085 6.085 6.085 6.085 0 0 1-6.085-6.085 6.085 6.085 0 0 1 4.66-5.916 4.301 4.301 0 0 1-.152-1.136 4.301 4.301 0 0 1 4.301-4.301zm0 1.849a2.453 2.453 0 0 0-2.453 2.453 2.453 2.453 0 0 0 2.453 2.453 2.453 2.453 0 0 0 2.453-2.453 2.453 2.453 0 0 0-2.453-2.453zm-2.724 5.268a4.237 4.237 0 0 0-4.237 4.237 4.237 4.237 0 0 0 4.237 4.237 4.237 4.237 0 0 0 4.237-4.237 4.237 4.237 0 0 0-4.237-4.237zm.032 2.54a1.781 1.781 0 1 1 0 3.562 1.781 1.781 0 0 1 0-3.562Z" },
    "paramountplus": { name: "Paramount+", bg: "#0064FF", ink: "#ffffff", kind: "", path: "M16.347 21.373c.057-.084.151-.314-.025-.74l-.53-1.428c-.073-.182.084-.293.19-.173 0 0 1.004 1.157 1.264 1.64l.495.822c.425.028 1.6.06 2.732.06a3.26 3.26 0 0 1-.316-.364c-1.93-2.392-3.154-3.724-3.166-3.737-.391-.426-.572-.508-.87-.643a4.82 4.82 0 0 1-.138-.065v.364c0 .047-.057.073-.086.022l-2.846-5.001a1.598 1.598 0 0 0-.508-.587l-.277-.194-1.354 3.123c.212 0 .354.216.27.409l-1.25 2.893h1.147c.443 0 .883.087 1.294.255l.302.125s-.913 1.878-.913 2.867c0 .181.028.362.075.534h2.104l-.096-.595s1.266.294 2.502.413M12 2.437c-6.627 0-12 5.373-12 12 0 2.669.873 5.133 2.346 7.126.503-.218.783-.542.983-.791l2.234-2.858a.467.467 0 0 1 .179-.138l.336-.146 3.674-4.659.534-.417 1.094-1.524a.482.482 0 0 1 .101-.102l.478-.347a.34.34 0 0 1 .398-.004l.578.407c.308.216.557.504.726.84l2.322 4.077c.051.09.09.129.182.174.454.227.732.268 1.33.913.277.304 1.495 1.666 3.203 3.784.236.318.538.588.963.783A11.948 11.948 0 0 0 24 14.437c0-6.627-5.373-12-12-12M3.236 15.1l-.778-.253-.48.662v-.818l-.778-.253.778-.253v-.818l.48.662.778-.253-.48.662Zm-.185 2.676-.252.778-.253-.778h-.818l.661-.481-.253-.777.663.48.66-.48-.252.777.662.481Zm.156-6.195.253.778-.661-.48-.663.48.253-.778-.66-.48h.817l.253-.778.252.777h.818Zm1.314-1.76L4.04 9.16l-.778.253.48-.661-.48-.663.778.254.48-.662v.818l.778.253-.777.252Zm2.045-2.862-.253.777-.252-.777h-.818l.662-.48-.253-.778.661.48.661-.48-.252.777.662.48Zm2.577-1.313-.48.661V5.49l-.779-.254.778-.253v-.817l.48.66.78-.253-.481.663.48.66zm3.265-.75.253.778-.661-.48-.662.48.252-.777-.66-.481h.818L12 3.637l.252.778h.818zm2.93.595v.816l-.481-.661-.777.252.48-.662-.48-.662.777.253.48-.66v.817l.779.252zm5.426 8.285.778.253.48-.662v.818l.778.253-.778.253v.818l-.48-.662-.778.253.48-.662zm-3.077-6.04-.253-.777h-.818l.662-.48-.253-.778.662.48.662-.48-.254.778.662.48h-.818zm1.792 2.086v-.818l-.777-.252.777-.253V7.68l.481.662.777-.254-.48.663.48.66-.777-.252zm1.469 1.278.253-.777.254.777h.816l-.66.481.252.778-.662-.48-.661.48.253-.778-.662-.48zm.506 6.676-.253.778-.253-.778h-.817l.662-.481-.253-.777.66.48.663-.48-.253.777.661.481zm-12.08-.615.76-1.588c.024-.048-.032-.108-.067-.067l-.664.668c-.313.329-.847 1.25-.95 1.421l-.808 1.335a.109.109 0 0 1 .1.162l-.739 1.238c-.18.309.145.523.189.452 1.157-1.868 1.832-1.719 1.832-1.719l.387-.897c.022-.047-.001-.1-.05-.12-.12-.05-.316-.27.01-.885z" },
    "peloton": { name: "Peloton", bg: "#181A1D", ink: "#ffffff", kind: "", path: "M17.7283 5.7642l1.7307-3.0066c.5045-.8803.2077-2.0077-.6725-2.5121-.8802-.5044-2.0077-.2077-2.5121.6725l-1.7407 3.0066c-3.699-1.167-7.843.3462-9.8606 3.8473-1.2857 2.2253-1.444 4.7869-.6626 7.032l3.2044-5.5583c.732-1.2759 1.9286-2.1858 3.3528-2.5715 1.4242-.3857 2.9078-.188 4.1836.5539 2.6308 1.523 3.5407 4.9055 2.0176 7.5363-1.523 2.6308-4.8957 3.5407-7.5364 2.0176l1.8396-3.1846c.8803.5044 2.0077.2077 2.5122-.6726.5044-.8802.2076-2.0077-.6726-2.512-.8802-.5045-2.0077-.2078-2.5121.6725l-5.855 10.1572c-.5044.8803-.2077 2.0077.6725 2.5121.8802.5044 2.0077.2077 2.5121-.6725L9.47 20.0754c3.699 1.167 7.843-.3462 9.8606-3.8473 2.0176-3.4913 1.256-7.833-1.6022-10.4639z" },
    "duolingo": { name: "Duolingo", bg: "#58CC02", ink: "#111111", kind: "", path: "M14.484 18.213c1.142 1.033 2.657 1.662 4.316 1.662l.294-.001c1.985-.038 3.749-.976 4.905-2.422v1.98c0 2.522-2.043 4.568-4.567 4.568H4.569C2.045 23.998.002 21.954.002 19.43v-1.92c1.181 1.443 2.976 2.365 4.985 2.365l.35-.001c1.61-.027 3.076-.646 4.191-1.648.555.764 1.456 1.26 2.473 1.26 1.023 0 1.928-.502 2.483-1.273zm-5.349-.996c-.989 1.022-2.375 1.658-3.909 1.658h-.239c-2.229 0-4.146-1.343-4.987-3.262v-7.16c.281-.64.68-1.216 1.169-1.699-.035-.731.132-1.469.511-2.128.256-.44.867-.504 1.21-.124l.766.851c.007-.003.014-.003.021-.005-.098-.78.037-1.587.419-2.308.24-.45.757-.53 1.114-.164 0 0 3.939 3.979 4.035 4.084 1.542 1.348 4.066 1.287 5.686-.18.002-.003.007-.005.009-.007.042-.042 3.855-3.9 3.855-3.9.3361-.3451.8619-.3101 1.113.164.385.724.518 1.535.417 2.32.002.001.003.001.004.002l.007.002c.001 0 .002 0 .003.001l.776-.86c.342-.38.954-.316 1.207.124.387.673.553 1.427.509 2.173.496.501.897 1.099 1.169 1.762v6.941c-.816 1.978-2.761 3.373-5.032 3.373H18.8c-1.547 0-2.945-.648-3.936-1.686a.8386.8386 0 0 0-.009-.067c.313-.017.528-.162.688-.33.152-.16.299-.397.299-.776 0 0-.022-.312-.024-.324.693.767 1.696 1.249 2.811 1.249 2.092 0 3.787-1.696 3.787-3.787v-2.243c0-2.092-1.697-3.787-3.787-3.787-2.093 0-3.787 1.695-3.787 3.787v2.243c0 .266.027.526.079.776-.712-.784-1.744-1.278-2.842-1.278-1.239 0-2.339.523-3.064 1.355.063-.274.097-.56.097-.853v-2.243c0-2.092-1.697-3.787-3.788-3.787-2.09 0-3.787 1.695-3.787 3.787v2.243c0 2.093 1.697 3.787 3.787 3.787 1.151 0 2.182-.513 2.876-1.322-.008.035-.039.395-.039.395 0 .378.147.616.298.775.16.168.374.312.688.331a.7783.7783 0 0 0-.012.097zm.997.073c.729.131 1.733.305 1.792.305h.157c.059 0 1.789-.303 1.789-.303-.327.705-1.041 1.194-1.869 1.194-.829 0-1.543-.49-1.869-1.196zm-.971-1.379c.246-1.313 1.462-2.259 2.918-2.259 1.324 0 2.521.97 2.763 2.259v.105c0 .082-.029.115-.103.106l-2.658.473h-.157l-2.66-.476c-.075.01-.103-.023-.103-.105Zm8.023-6.392c.255-.14.549-.22.861-.22.992 0 1.798.804 1.798 1.798v1.919c0 .991-.804 1.797-1.798 1.797-.991 0-1.797-.803-1.797-1.797v-1.542c.034.003.068.005.103.005.64 0 1.16-.518 1.16-1.156 0-.312-.125-.596-.327-.804zM5.162 9.461c.227-.104.48-.162.746-.162.991 0 1.798.804 1.798 1.798v1.919c0 .991-.804 1.797-1.798 1.797-.991 0-1.797-.803-1.797-1.797v-1.571c.089.022.182.034.278.034.641 0 1.16-.518 1.16-1.156 0-.342-.149-.65-.387-.862ZM.002 6.554V4.568C.002 2.044 2.045 0 4.569 0h14.865c2.522 0 4.565 2.044 4.565 4.568v2.041a5.1847 5.1847 0 0 0-.164-.197 4.8592 4.8592 0 0 0-.646-2.284c-.433-.754-1.315-1.037-2.07-.786a4.785 4.785 0 0 0-.327-.774h-.001c-.287-.54-.758-.835-1.248-.908-.493-.073-1.033.072-1.464.515l-3.82 3.864c-1.226 1.11-3.127 1.199-4.313.205-.103-.109-4.025-4.071-4.025-4.071-.427-.438-.966-.584-1.46-.51-.489.073-.961.367-1.248.907v.002c-.133.25-.241.508-.327.771-.753-.252-1.635.029-2.071.782 0 0-.001.001-.001.002-.4.694-.613 1.459-.645 2.23-.057.065-.113.13-.167.197z" },
    "verizon": { name: "Verizon", bg: "#CD040B", ink: "#ffffff", kind: "", path: "M18.302 0H22v.003L10.674 24H7.662L2 12h3.727l3.449 7.337z" },
    "target": { name: "Target", bg: "#CC0000", ink: "#ffffff", kind: "", path: "M12.0005 0C18.627 0 24 5.373 24 12.0005 24 18.627 18.627 24 11.9995 24 5.373 24 0 18.627 0 11.9995 0 5.373 5.373 0 12.0005 0zm0 19.826a7.8265 7.8265 0 10-.001-15.652C7.7133 4.2246 4.2653 7.7136 4.2653 12c0 4.2864 3.448 7.7754 7.7342 7.826h.001zm0-3.9853a3.8402 3.8402 0 110-7.6803c2.1204.0006 3.839 1.7197 3.839 3.8401s-1.7186 3.8396-3.839 3.8402z" },
    "zillow": { name: "Zillow", bg: "#006AFF", ink: "#ffffff", kind: "home", path: "M12.006 0L1.086 8.627v3.868c3.386-2.013 11.219-5.13 14.763-6.015.11-.024.16.005.227.078.372.427 1.586 1.899 1.916 2.301a.128.128 0 0 1-.03.195 43.607 43.607 0 0 0-6.67 6.527c-.03.037-.006.043.012.03 2.642-1.134 8.828-2.94 11.622-3.452V8.627zm-.48 11.177c-2.136.708-8.195 3.307-10.452 4.576V24h21.852v-7.936c-2.99.506-11.902 3.16-15.959 5.246a.183.183 0 0 1-.23-.036l-2.044-2.429c-.055-.061-.062-.098.011-.208 1.574-2.3 4.789-5.899 6.833-7.418.042-.03.031-.06-.012-.042Z" },
    "toyota": { name: "Toyota", bg: "#EB0A1E", ink: "#ffffff", kind: "car", path: "M12 3.848C5.223 3.848 0 7.298 0 12c0 4.702 5.224 8.152 12 8.152S24 16.702 24 12c0-4.702-5.223-8.152-12-8.152zm7.334 3.839c0 1.08-1.725 1.913-4.488 2.246-.26-2.58-1.005-4.279-1.963-4.913 2.948.184 6.45 1.227 6.45 2.667zM12 16.401c-.96 0-1.746-1.5-1.808-4.389.577.047 1.18.072 1.808.072.628 0 1.23-.025 1.807-.072-.061 2.89-.847 4.389-1.807 4.389zm0-6.308c-.59 0-1.155-.019-1.69-.054.261-1.728.92-3.15 1.69-3.15.77 0 1.428 1.422 1.689 3.15-.535.034-1.099.054-1.689.054zm-.882-5.075c-.956.633-1.706 2.333-1.964 4.915C6.391 9.6 4.665 8.767 4.665 7.687c0-1.44 3.504-2.49 6.453-2.669zM2.037 11.68a5.265 5.265 0 011.048-3.164c.27 1.547 2.522 2.881 5.972 3.37V12c0 3.772.879 6.203 2.087 6.97-5.107-.321-9.107-3.48-9.107-7.29zm10.823 7.29c1.207-.767 2.087-3.198 2.087-6.97v-.115c3.447-.488 5.704-1.826 5.972-3.37a5.26 5.26 0 011.049 3.165c-.004 3.81-4.008 6.969-9.109 7.29z" },
    "honda": { name: "Honda", bg: "#E40521", ink: "#ffffff", kind: "car", path: "M23.902 6.87c-.33-3.218-2.47-3.895-4.354-4.204-.946-.16-2.63-.3-3.716-.34-.946-.06-3.168-.09-3.835-.09-.657 0-2.89.03-3.835.09-1.076.04-2.77.18-3.716.34C2.563 2.985.42 3.66.092 6.87c-.08.877-.1 2.023-.09 3.248.03 2.031.2 3.406.3 4.363.07.657.338 2.62.687 3.636.478 1.395.916 1.803 1.424 2.222.937.757 2.471.996 2.79 1.056 1.733.31 5.24.368 6.784.368 1.544 0 5.05-.05 6.784-.368.329-.06 1.863-.29 2.79-1.056.508-.419.946-.827 1.424-2.222.35-1.016.628-2.979.698-3.636.1-.957.279-2.332.299-4.363.04-1.225.01-2.371-.08-3.248m-1.176 5.4c-.19 2.57-.418 4.104-.747 5.22-.29.976-.637 1.623-1.165 2.092-.867.787-2.063.956-2.76 1.056-1.514.23-4.055.3-6.057.3-2.002 0-4.543-.08-6.057-.3-.697-.1-1.893-.269-2.76-1.056-.518-.469-.876-1.126-1.155-2.093-.329-1.105-.558-2.65-.747-5.22-.11-1.543-.09-4.054.08-5.4.258-2.011 1.255-3.018 3.387-3.396.996-.18 2.34-.31 3.606-.37 1.016-.07 2.7-.1 3.636-.09.936-.01 2.62.03 3.636.09 1.275.06 2.61.19 3.606.37 2.142.378 3.139 1.395 3.388 3.397.199 1.345.229 3.856.11 5.4m-5.202-8.39c-.548 2.462-.767 3.588-1.216 5.37-.428 1.715-.767 3.298-1.335 4.065-.587.777-1.365.947-1.893 1.006-.279.03-.478.04-1.066.05-.596 0-.796-.02-1.075-.05-.528-.06-1.315-.229-1.892-1.006-.578-.767-.907-2.35-1.335-4.064-.47-1.773-.678-2.91-1.236-5.37 0 0-.548.02-.797.04-.329.02-.588.05-.867.09.343 5.372.692 11.079 1.126 16.13a21.983 21.983 0 002.39.169c.33-1.266.748-3.02 1.207-3.767.378-.608.966-.677 1.295-.717.518-.07.956-.08 1.165-.08.2-.01.637 0 1.165.08.33.05.917.11 1.295.717.47.747.877 2.5 1.206 3.766 0 0 .358-.01 1.165-.05.41-.018.82-.058 1.226-.12.458-5.39.785-10.728 1.126-16.128-.28-.04-.538-.07-.867-.09-.23-.02-.787-.04-.787-.04z" },
    "tesla": { name: "Tesla", bg: "#CC0000", ink: "#ffffff", kind: "car", path: "M12 5.362l2.475-3.026s4.245.09 8.471 2.054c-1.082 1.636-3.231 2.438-3.231 2.438-.146-1.439-1.154-1.79-4.354-1.79L12 24 8.619 5.034c-3.18 0-4.188.354-4.335 1.792 0 0-2.146-.795-3.229-2.43C5.28 2.431 9.525 2.34 9.525 2.34L12 5.362l-.004.002H12v-.002zm0-3.899c3.415-.03 7.326.528 11.328 2.28.535-.968.672-1.395.672-1.395C19.625.612 15.528.015 12 0 8.472.015 4.375.61 0 2.349c0 0 .195.525.672 1.396C4.674 1.989 8.585 1.435 12 1.46v.003z" },
    "ford": { name: "Ford", bg: "#00274E", ink: "#ffffff", kind: "car", path: "M12 8.236C5.872 8.236.905 9.93.905 12.002S5.872 15.767 12 15.767c6.127 0 11.094-1.693 11.094-3.765 0-2.073-4.967-3.766-11.094-3.766zm-5.698 6.24c-.656.005-1.233-.4-1.3-1.101a1.415 1.415 0 0 1 .294-1.02c.195-.254.525-.465.804-.517.09-.017.213-.006.264.054.079.093.056.194-.023.234-.213.109-.47.295-.597.55a.675.675 0 0 0 .034.696c.263.397.997.408 1.679-.225.169-.156.32-.304.473-.48.3-.344.4-.47.8-1.024.005-.006.006-.014.004-.018-.003-.007-.009-.01-.02-.01-.267.007-.5.087-.725.255-.065.048-.159.041-.2-.021-.046-.07-.013-.163.062-.215.363-.253.76-.298 1.166-.367 0 0 .028.002.051-.03.167-.213.292-.405.47-.621.178-.22.41-.42.586-.572.246-.212.404-.283.564-.37.043-.022-.005-.049-.018-.049-.896-.168-1.827-.386-2.717-.056-.616.23-.887.718-.757 1.045.093.231.397.27.683.13a1.55 1.55 0 0 0 .611-.544c.087-.134.27-.038.171.195-.26.611-.757 1.097-1.363 1.118-.516.016-.849-.363-.848-.831.002-.924 1.03-1.532 2.11-1.622 1.301-.108 2.533.239 3.825.395.989.12 1.938.123 2.932-.106.118-.025.2.05.193.168-.01.172-.143.337-.47.516-.373.204-.763.266-1.17.27-.984.008-1.901-.376-2.85-.582.002.041.012.091-.023.117-.525.388-1 .782-1.318 1.334-.011.013-.005.025.013.024.277-.015.525-.022.783-.042.045-.004.047-.015.043-.048a.64.64 0 0 1 .2-.558c.172-.153.387-.17.53-.06.16.126.147.353.058.523a.63.63 0 0 1-.382.31s-.03.006-.026.034c.006.043.2.151.217.18.017.027.008.07-.021.102a.123.123 0 0 1-.095.045c-.033 0-.053-.012-.096-.035a.92.92 0 0 1-.27-.217c-.024-.031-.037-.032-.099-.029-.279.017-.714.059-1.009.096-.071.008-.082.022-.096.047-.47.775-.972 1.61-1.523 2.17-.592.6-1.083.758-1.604.762zM19.05 10.71c-.091.158-1.849 2.834-1.96 3.11-.035.088-.04.155-.004.204.092.124.297.051.425-.038.381-.262.645-.58.937-.858.017-.013.046-.018.065 0 .043.04.106.091.15.137a.04.04 0 0 1 .002.057 5.873 5.873 0 0 1-.904.911c-.47.364-.939.457-1.172.224a.508.508 0 0 1-.14-.316c-.002-.057-.031-.06-.058-.034-.278.275-.76.579-1.198.362-.366-.18-.451-.618-.383-.986.001-.008-.006-.06-.051-.03a1.28 1.28 0 0 1-.3.162.853.853 0 0 1-.366.077.518.518 0 0 1-.451-.253.759.759 0 0 1-.095-.347c-.001-.011-.017-.032-.033-.005-.3.457-.579.899-.875 1.363-.016.022-.03.036-.06.037l-.587.001c-.036 0-.053-.028-.034-.063.104-.2.674-1.03 1.06-1.736.107-.194.085-.294.019-.337-.083-.054-.248.027-.387.133-.379.287-.697.735-.859.935-.095.117-.185.291-.433.56-.391.425-.91.669-1.408.5a.848.848 0 0 1-.546-.58c-.015-.052-.044-.066-.073-.032-.08.1-.245.249-.383.342-.015.011-.052.033-.084.017a.851.851 0 0 1-.152-.199.07.07 0 0 1 .016-.08c.197-.173.305-.271.391-.38.064-.08.113-.17.17-.315.12-.302.393-.866.938-1.158a1.81 1.81 0 0 1 .652-.219c.1-.01.183.002.213.08.011.033.039.105.056.158.011.032.003.057-.035.071-.32.122-.643.311-.865.61-.253.338-.321.746-.152.98.123.17.322.2.514.139.29-.092.538-.363.666-.663.138-.329.16-.717.058-1.059-.016-.059-.001-.104.037-.136.077-.063.184-.112.215-.128a.14.14 0 0 1 .182.045c.106.157.163.378.17.607.006.049.026.05.05.025.19-.202.366-.418.568-.58.185-.147.422-.267.643-.262.286.006.428.2.419.546-.001.044.03.04.051.011a1.19 1.19 0 0 1 .24-.264c.198-.163.4-.236.611-.222.26.02.468.257.425.527a.53.53 0 0 1-.281.406.362.362 0 0 1-.405-.044.336.336 0 0 1-.096-.322c.005-.025-.027-.048-.054-.02-.254.264-.273.606-.107.76.183.17.458.056.658-.075.366-.239.65-.563.979-.813.218-.166.467-.314.746-.351a.87.87 0 0 1 .454.052c.2.081.326.25.342.396.004.043.036.048.063.01.158-.246 1.005-1.517 1.075-1.65.02-.041.044-.047.089-.047h.606c.035 0 .051.02.036.047zm-2.32 2.204a.053.053 0 0 0-.003.04c.003.02.03.04.056.05.01.003.015.01.004.032-.075.16-.143.252-.237.391a1.472 1.472 0 0 1-.3.325c-.178.147-.424.307-.628.2-.09-.047-.13-.174-.127-.276.004-.288.132-.584.369-.875.288-.355.607-.539.816-.438.216.103.148.354.05.55zm-5.949-1.881a.398.398 0 0 1 .132-.345c.057-.05.133-.062.18-.022.052.045.027.157-.026.234a.43.43 0 0 1-.245.177c-.018.004-.034-.004-.041-.044zM12 7.5C5.34 7.5 0 9.497 0 12c0 2.488 5.383 4.5 12 4.5s12-2.02 12-4.5-5.383-4.5-12-4.5zm0 8.608C5.649 16.108.5 14.27.5 12.002.5 9.733 5.65 7.895 12 7.895s11.498 1.838 11.498 4.107c0 2.268-5.148 4.106-11.498 4.106z" },
    "subaru": { name: "Subaru", bg: "#013C74", ink: "#ffffff", kind: "car", path: "M12 4.983c3.004 0 6.224.612 8.786 2.239C22.451 8.286 24 9.9 24 12.002c0 2.456-2.097 4.242-4.106 5.287-2.391 1.238-5.216 1.728-7.894 1.728-3.003 0-6.217-.605-8.78-2.238C1.556 15.714 0 14.101 0 12.003 0 9.536 2.092 7.757 4.106 6.71 6.504 5.474 9.323 4.983 12 4.983zm-.025.746c-2.793 0-5.802.523-8.225 1.983-1.524.912-3.03 2.347-3.03 4.253 0 2.239 2.04 3.806 3.864 4.706 2.258 1.102 4.897 1.53 7.391 1.53 2.798 0 5.809-.523 8.232-1.983 1.517-.918 3.029-2.346 3.029-4.253 0-2.243-2.035-3.813-3.864-4.705-2.258-1.104-4.898-1.53-7.397-1.53zm-10.54 4.686l4.597-.784 1.384-3.003L8.794 9.63l4.596.784-4.596.792-1.378 3.01-1.384-3.01zm10.106 2.289l2.028-.356.605-1.359.606 1.359 2.028.356-2.028.35-.606 1.36-.605-1.36zm4.196-3.621l2.028-.35.605-1.365.606 1.364 2.028.35-2.028.357-.606 1.36-.606-1.36zM13.57 15.51l2.02-.35.607-1.365.612 1.365 2.027.35-2.027.357-.612 1.36-.606-1.36zm-6.23.491l2.028-.35.612-1.366.605 1.366 2.028.35-2.028.357-.605 1.359-.612-1.359zm10.196-3.353l2.022-.357.605-1.359.612 1.359 2.028.357-2.028.35-.612 1.357-.606-1.357Z" },
    "mazda": { name: "Mazda", bg: "#101010", ink: "#ffffff", kind: "car", path: "M11.999 12.876c-.036 0-.105-.046-.222-.26a7.531 7.531 0 00-1.975-2.353A8.255 8.255 0 007.7 9.065a17.945 17.945 0 00-.345-.136c-1.012-.4-2.061-.813-3.035-1.377A8.982 8.982 0 014 7.362c.194-.34.42-.665.67-.962a6.055 6.055 0 011.253-1.131 7.126 7.126 0 011.618-.806c1.218-.434 2.677-.647 4.458-.649 1.783.002 3.241.215 4.459.65a7.097 7.097 0 011.619.805c.471.319.892.699 1.253 1.13.25.298.475.623.67.963-.103.064-.212.129-.32.192-.976.564-2.023.977-3.037 1.376l-.345.136a8.26 8.26 0 00-2.1 1.198 7.519 7.519 0 00-1.975 2.354c-.117.213-.187.259-.224.259m0 7.072c-1.544-.002-2.798-.129-3.83-.387-1.013-.252-1.855-.64-2.576-1.188a5.792 5.792 0 01-1.392-1.537 7.607 7.607 0 01-.81-1.768 10.298 10.298 0 01-.467-2.983c0-.674.047-1.313.135-1.901 1.106.596 2.153.895 3.08 1.16l.215.06c1.29.371 2.314.857 3.135 1.488.475.368.89.793 1.23 1.264.369.508.663 1.088.877 1.725.096.289.2.468.403.468.207 0 .308-.18.405-.468a6.124 6.124 0 012.107-2.988c.82-.632 1.845-1.118 3.135-1.489l.216-.06c.926-.265 1.973-.564 3.078-1.16.09.589.136 1.227.136 1.9 0 .458-.046 1.664-.465 2.984a7.626 7.626 0 01-.809 1.768 5.789 5.789 0 01-1.396 1.537c-.723.548-1.565.936-2.574 1.188-1.035.258-2.288.385-3.833.387m9.692-14.556c-1.909-2.05-4.99-2.99-9.692-2.995-4.7.005-7.781.944-9.69 2.994C.89 6.913 0 9.018 0 11.874c0 1.579.39 5.6 3.564 7.676 1.9 1.242 4.354 2.046 8.435 2.052 4.083-.006 6.536-.81 8.437-2.052C23.609 17.474 24 13.452 24 11.874c0-2.848-.897-4.968-2.31-6.483Z" },
    "hyundai": { name: "Hyundai", bg: "#002C5E", ink: "#ffffff", kind: "car", path: "M12 18.1622c-6.6275 0-12-2.7586-12-6.163 0-3.4028 5.3725-6.1614 12-6.1614 6.6278 0 12 2.7586 12 6.1614 0 3.4044-5.3722 6.163-12 6.163zM7.6023 7.17C3.701 7.9784.973 9.8302.973 11.9844c0 1.1929.8382 2.2932 2.248 3.1757.1174.0724.1941.0862.251.0826.1019-.006.1593-.0698.201-.146.028-.0485.0631-.1225.0972-.1968.4601-1.0834 2.0776-4.8333 4.2023-7.3758a1.1775 1.1775 0 0 0 .1048-.1461c.046-.084.0356-.1513.0006-.192-.0593-.0647-.2247-.065-.4756-.016zM9.742 8.8995c-1.1728 2.8492 1.0473 2.4961 1.6478 2.3637 1.0203-.2258 1.9944-.6128 2.7746-.925 2.2216-.8887 3.4012-1.7804 3.7925-2.123a1.9839 1.9839 0 0 0 .1076-.0988c.0557-.058.0976-.1192.0976-.2002 0-.0936-.081-.1687-.2374-.2231-.012-.0049-.0517-.021-.0641-.025-1.698-.5415-3.724-.8563-5.9016-.8563-.0168 0-.0586-.0022-.1169 0-.2608.0078-.5509.0664-.787.1888-.7777.4049-1.1163 1.4235-1.313 1.899zm10.5851.0037c-.0268.0487-.0612.1224-.0962.1974-.4599 1.0826-2.0774 4.831-4.2018 7.3733-.0515.063-.0796.1031-.1042.1467-.0492.0846-.0388.1535 0 .1935.0572.0641.2235.0654.474.0157 3.8998-.81 6.628-2.6606 6.628-4.8149 0-1.1925-.836-2.2928-2.2472-3.1745-.1161-.073-.1934-.0871-.25-.083-.1028.0067-.16.0699-.2026.1458zM14.258 15.099c1.173-2.849-1.0483-2.494-1.6467-2.3622-1.0218.225-1.996.613-2.7757.924-2.2226.8883-3.4017 1.782-3.7944 2.1234-.0468.0428-.0833.0742-.1066.0995-.0564.0573-.0967.1178-.0967.2007 0 .0923.08.1688.2362.2229.012.0048.0511.0213.0657.0255 1.696.54 3.722.8557 5.9.8557.0177 0 .0592.0016.1178 0 .2609-.0081.5522-.0677.7871-.1888.7781-.4052 1.1169-1.4234 1.3133-1.9007z" },
    "kia": { name: "Kia", bg: "#05141F", ink: "#ffffff", kind: "car", path: "M13.923 14.175c0 .046.015.072.041.072a.123.123 0 0 0 .058-.024l7.48-4.854a.72.72 0 0 1 .432-.13h1.644c.252 0 .422.168.422.42v3.139c0 .38-.084.6-.42.801l-1.994 1.2a.137.137 0 0 1-.067.024c-.024 0-.048-.019-.048-.088v-3.663c0-.043-.012-.071-.041-.071a.113.113 0 0 0-.058.024l-5.466 3.551a.733.733 0 0 1-.42.127h-3.624c-.254 0-.422-.168-.422-.422V9.757c0-.033-.015-.064-.044-.064a.118.118 0 0 0-.057.024L7.732 11.88c-.036.024-.046.041-.046.058 0 .014.008.029.032.055l2.577 2.575c.034.034.058.06.058.089 0 .024-.039.043-.084.043H7.94c-.183 0-.324-.026-.423-.125l-1.562-1.56a.067.067 0 0 0-.048-.024.103.103 0 0 0-.048.015l-2.61 1.57a.72.72 0 0 1-.423.122H.425C.168 14.7 0 14.53 0 14.279v-3.08c0-.38.084-.6.422-.8L2.43 9.192a.103.103 0 0 1 .052-.016c.032 0 .048.03.048.1V13.4c0 .043.01.063.041.063a.144.144 0 0 0 .06-.024L9.407 9.36a.733.733 0 0 1 .446-.124h3.648c.252 0 .422.168.422.42l-.002 4.518z" },
    "nissan": { name: "Nissan", bg: "#C3002F", ink: "#ffffff", kind: "car", path: "M20.576 14.955l-.01.028c-1.247 3.643-4.685 6.086-8.561 6.086-3.876 0-7.32-2.448-8.562-6.09l-.01-.029H.71v.329l1.133.133c.7.08.847.39 1.038.78l.048.096c1.638 3.495 5.204 5.752 9.08 5.752 3.877 0 7.443-2.257 9.081-5.747l.048-.095c.19-.39.338-.7 1.038-.781l1.134-.134v-.328zM3.443 9.012c1.247-3.643 4.686-6.09 8.562-6.09 3.876 0 7.319 2.447 8.562 6.09l.01.028h2.728v-.328l-1.134-.133c-.7-.081-.847-.39-1.038-.781l-.047-.096C19.448 4.217 15.88 1.96 12.005 1.96c-3.881 0-7.443 2.257-9.081 5.752l-.048.095c-.19.39-.338.7-1.038.781l-1.133.133v.329h2.724zm13.862 1.586l-1.743 2.795h.752l.31-.5h2.033l.31.5h.747l-1.743-2.795zm1.033 1.766h-1.395l.7-1.124zm2.81-1.066l2.071 2.095H24v-2.795h-.614v2.085l-2.062-2.085h-.795v2.795h.619zM0 13.393h.619v-2.095l2.076 2.095h.781v-2.795h-.619v2.085L.795 10.598H0zm4.843-2.795h.619v2.795h-.62zm4.486 2.204c-.02.005-.096.005-.124.005H6.743v.572h2.5c.019 0 .167 0 .195-.005.51-.048.743-.472.743-.843 0-.381-.243-.79-.705-.833-.09-.01-.166-.01-.2-.01H7.643a.83.83 0 0 1-.181-.014c-.129-.034-.176-.148-.176-.243 0-.086.047-.2.18-.238a.68.68 0 0 1 .172-.014h2.357v-.562H7.6c-.1 0-.176.004-.238.014a.792.792 0 0 0-.695.805c0 .343.214.743.685.81.086.009.205.009.258.009H9.2c.029 0 .1 0 .114.005.181.023.243.157.243.276a.262.262 0 0 1-.228.266zm4.657 0c-.02.005-.096.005-.129.005H11.4v.572h2.5c.019 0 .167 0 .195-.005.51-.048.743-.472.743-.843 0-.381-.243-.79-.705-.833-.09-.01-.166-.01-.2-.01H12.3a.83.83 0 0 1-.181-.014c-.129-.034-.176-.148-.176-.243 0-.086.047-.2.18-.238a.68.68 0 0 1 .172-.014h2.357v-.562h-2.395c-.1 0-.176.004-.238.014a.792.792 0 0 0-.695.805c0 .343.214.743.686.81.085.009.204.009.257.009h1.59c.029 0 .1 0 .114.005.181.023.243.157.243.276a.267.267 0 0 1-.228.266Z" },
    "chevrolet": { name: "Chevrolet", bg: "#CD9834", ink: "#111111", kind: "car", path: "M23.905 9.784H15.92V8.246a.157.157 0 00-.157-.158H8.238a.157.157 0 00-.157.158v1.538H2.358c-.087 0-.193.07-.237.158L.02 14.058c-.045.088-.011.157.077.157H8.08v1.54c0 .086.07.157.157.157h7.525c.087 0 .157-.07.157-.157v-1.54h5.723c.087 0 .193-.07.238-.157l2.1-4.116c.045-.087.011-.158-.076-.158m-2.494.996l-1.244 2.437h-5.232v1.708H9.07v-1.708H2.595L3.84 10.78h5.232V9.073h5.864v1.707z" },
    "jeep": { name: "Jeep", bg: "#000000", ink: "#ffffff", kind: "car", path: "M4.1651 7.1687v5.2011c0 .6762-.444 1.0777-1.1628 1.0777-.7185 0-1.0992-.5283-1.0992-1.0992v-.9299H0v.9514c0 .972.296 2.7068 3.0235 2.7068 2.7272 0 3.1082-1.8614 3.1082-2.7488V7.1687Zm4.9177 2.1562c-1.7973 0-2.6003 1.6485-2.6003 3.0657 0 1.4168.9094 2.7912 2.7695 2.7912 1.6285.021 2.707-1.0361 2.707-1.8187h-1.7977s-.2113.5078-.8458.5078c-.6343 0-.9934-.3596-.9934-1.2265h3.6576c0-2.7277-1.3526-3.3195-2.897-3.3195zm5.8471 0c-1.7968 0-2.6007 1.6485-2.6007 3.0657 0 1.4168.9094 2.7912 2.7705 2.7912 1.628.021 2.7067-1.0361 2.7067-1.8187h-1.7978s-.2116.5078-.8454.5078c-.6348 0-.9942-.3596-.9942-1.2265h3.6574c0-2.7277-1.3523-3.3195-2.8965-3.3195zm6.7435.0635c-.9132 0-1.3186.4962-1.3401.522-.1283.1538-.2875.3165-.2875-.0782v-.2959h-1.8193v7.295h1.8398V14.822c0-.148.1478-.126.2543 0 .1063.1277.5711.4443 1.3752.4443C23.155 15.2663 24 13.9978 24 12.264c0-2.2415-1.4162-2.8757-2.3266-2.8756Zm-12.401 1.1203c.6766 0 .972.5073.972 1.0365H8.3843c0-.5718.2327-1.0365.8882-1.0365zm5.8468 0c.6767 0 .9724.5073.9724 1.0365H14.231c0-.5718.2332-1.0365.8883-1.0365zm5.9204.296c.9318 0 1.1.7189 1.1 1.4593 0 .74-.1272 1.7124-1.0141 1.7124-.8884 0-1.1212-.5709-1.1017-1.6486.022-1.0788.4441-1.523 1.0158-1.523zm2.2813 4.5664a.5855.5855 0 0 0-.5856.5857c0 .3233.2617.5856.5856.5856.3218 0 .585-.2623.585-.5856 0-.3233-.2632-.5857-.585-.5857zm0 .062a.524.524 0 0 1 .5236.5237c0 .2884-.2346.5246-.5236.5246a.5258.5258 0 0 1-.525-.5246c0-.289.2352-.5236.525-.5236zm-.2108.2024v.6208h.0725v-.2689h.1764l.1159.269h.0806l-.1216-.2873c.0386-.0133.0514-.0227.072-.0447.0266-.0287.0434-.0739.0434-.115 0-.1034-.0796-.174-.195-.174zm.0705.0676h.1722c.072 0 .1177.041.1177.1045 0 .072-.0485.1168-.1278.1168h-.1621z" },
    "bmw": { name: "BMW", bg: "#0066B1", ink: "#ffffff", kind: "car", path: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 .78C18.196.78 23.219 5.803 23.219 12c0 6.196-5.022 11.219-11.219 11.219C5.803 23.219.781 18.196.781 12S5.804.78 12 .78zm-.678.63c-.33.014-.66.042-.992.078l-.107 2.944a9.95 9.95 0 0 1 .71-.094l.07-1.988-.013-.137.043.13.664 1.489h.606l.664-1.488.04-.131-.01.137.07 1.988c.232.022.473.054.71.094l-.109-2.944a14.746 14.746 0 0 0-.992-.078l-.653 1.625-.023.12-.023-.12-.655-1.625zm6.696 1.824l-1.543 2.428c.195.15.452.371.617.522l1.453-.754.092-.069-.069.094-.752 1.453c.163.175.398.458.53.63l2.43-1.544a16.135 16.135 0 0 0-.46-.568L18.777 6.44l-.105.092.078-.115.68-1.356-.48-.48-1.356.68-.115.078.091-.106 1.018-1.539c-.18-.152-.351-.291-.57-.46zM5.5 3.785c-.36.037-.638.283-1.393 1.125a18.97 18.97 0 0 0-.757.914l2.074 1.967c.687-.76.966-1.042 1.508-1.613.383-.405.6-.87.216-1.317-.208-.242-.558-.295-.85-.175l-.028.01.01-.026a.7.7 0 0 0-.243-.734.724.724 0 0 0-.537-.15zm.006.615c.136-.037.277.06.308.2.032.14-.056.272-.154.382-.22.25-1.031 1.098-1.031 1.098l-.402-.383c.417-.51.861-.974 1.062-1.158a.55.55 0 0 1 .217-.139zM12 4.883a7.114 7.114 0 0 0-7.08 6.388v.002a7.122 7.122 0 0 0 8.516 7.697 7.112 7.112 0 0 0 5.68-6.97A7.122 7.122 0 0 0 12 4.885v-.002zm-5.537.242c.047 0 .096.013.14.043.088.059.128.16.106.26-.026.119-.125.231-.205.318l-1.045 1.12-.42-.4s.787-.832 1.045-1.099c.102-.106.168-.17.238-.205a.331.331 0 0 1 .14-.037zM12 5.818A6.175 6.175 0 0 1 18.182 12H12v6.182A6.175 6.175 0 0 1 5.818 12H12V5.818Z" },
    "audi": { name: "Audi", bg: "#BB0A30", ink: "#ffffff", kind: "car", path: "M19.848,7.848c-0.992,0-1.902,0.348-2.616,0.928c-0.714-0.58-1.624-0.928-2.616-0.928 c-0.992,0-1.902,0.348-2.616,0.928c-0.714-0.58-1.624-0.928-2.616-0.928c-0.992,0-1.902,0.348-2.616,0.928 c-0.714-0.58-1.624-0.928-2.616-0.928C1.859,7.848,0,9.707,0,12s1.859,4.152,4.152,4.152c0.992,0,1.902-0.348,2.616-0.928 c0.714,0.58,1.624,0.928,2.616,0.928c0.992,0,1.902-0.348,2.616-0.928c0.714,0.58,1.624,0.928,2.616,0.928 c0.992,0,1.902-0.348,2.616-0.928c0.714,0.58,1.624,0.928,2.616,0.928C22.141,16.152,24,14.293,24,12S22.141,7.848,19.848,7.848z M17.232,13.866c-0.376-0.526-0.598-1.17-0.598-1.866c0-0.696,0.222-1.34,0.598-1.866c0.376,0.526,0.598,1.17,0.598,1.866 C17.83,12.696,17.608,13.34,17.232,13.866z M12,13.866c-0.376-0.526-0.598-1.17-0.598-1.866c0-0.696,0.222-1.34,0.598-1.866 c0.376,0.526,0.598,1.17,0.598,1.866C12.598,12.696,12.376,13.34,12,13.866z M6.768,13.866C6.392,13.34,6.17,12.696,6.17,12 c0-0.696,0.222-1.34,0.598-1.866C7.144,10.66,7.366,11.304,7.366,12C7.366,12.696,7.144,13.34,6.768,13.866z M0.938,12 c0-1.775,1.439-3.214,3.214-3.214c0.736,0,1.414,0.248,1.956,0.665C5.56,10.154,5.232,11.039,5.232,12 c0,0.961,0.328,1.846,0.876,2.549c-0.542,0.416-1.22,0.665-1.956,0.665C2.377,15.214,0.938,13.775,0.938,12z M7.428,14.549 C7.976,13.846,8.304,12.961,8.304,12c0-0.961-0.328-1.846-0.876-2.549c0.542-0.416,1.22-0.665,1.956-0.665 c0.736,0,1.414,0.248,1.956,0.665c-0.549,0.704-0.876,1.588-0.876,2.549c0,0.961,0.328,1.846,0.876,2.549 c-0.542,0.416-1.22,0.665-1.956,0.665C8.648,15.214,7.97,14.966,7.428,14.549z M12.66,14.549c0.549-0.704,0.876-1.588,0.876-2.549 c0-0.961-0.328-1.846-0.876-2.55c0.542-0.416,1.22-0.665,1.956-0.665s1.414,0.248,1.956,0.665 c-0.549,0.704-0.876,1.588-0.876,2.549c0,0.961,0.328,1.846,0.876,2.549c-0.542,0.416-1.22,0.665-1.956,0.665 C13.88,15.214,13.202,14.966,12.66,14.549z M19.848,15.214c-0.736,0-1.414-0.248-1.956-0.665c0.548-0.704,0.876-1.588,0.876-2.549 c0-0.961-0.328-1.846-0.876-2.549c0.542-0.416,1.22-0.665,1.956-0.665c1.775,0,3.214,1.439,3.214,3.214 S21.623,15.214,19.848,15.214z" },
    "volkswagen": { name: "Volkswagen", bg: "#151F5D", ink: "#ffffff", kind: "car", path: "M12 0C5.36 0 0 5.36 0 12S5.36 24 12 24 24 18.64 24 12 18.64 0 12 0M12 1.41C13.2 1.41 14.36 1.63 15.43 2L12.13 9.13C12.09 9.17 12.09 9.26 12 9.26S11.91 9.17 11.87 9.13L8.57 2C9.64 1.63 10.8 1.42 12 1.42M6.9 2.74L10.72 10.97C10.8 11.14 10.89 11.19 11 11.19H13C13.12 11.19 13.2 11.14 13.29 10.97L17.06 2.74C18.64 3.64 20 4.93 20.96 6.47L15.6 16.84C15.56 16.93 15.5 16.97 15.47 16.97C15.39 16.97 15.39 16.89 15.34 16.84L13.29 12.3C13.2 12.13 13.12 12.09 13 12.09H11C10.89 12.09 10.8 12.13 10.71 12.3L8.66 16.84C8.61 16.89 8.62 16.97 8.53 16.97C8.44 16.97 8.44 16.89 8.4 16.84L3 6.47C3.94 4.93 5.32 3.64 6.9 2.74M2.06 8.53L8.23 20.53C8.31 20.7 8.4 20.83 8.62 20.83C8.83 20.83 8.91 20.7 9 20.53L11.87 14.14C11.91 14.06 11.96 14 12 14C12.09 14 12.09 14.1 12.13 14.14L15.04 20.53C15.13 20.7 15.21 20.83 15.43 20.83C15.64 20.83 15.73 20.7 15.81 20.53L22 8.53C22.37 9.6 22.59 10.76 22.59 12C22.54 17.79 17.79 22.59 12 22.59C6.21 22.59 1.46 17.79 1.46 12C1.46 10.8 1.67 9.65 2.06 8.53Z" },
    "volvo": { name: "Volvo", bg: "#003057", ink: "#ffffff", kind: "car", path: "M10.873 12.584h.49l-.001-1.452h-.489v-.322h1.94v.322h-.483v1.451h.449c.415 0 .687-.274.687-.646h.32v.972h-2.913v-.325zm4.313.327h1.134l.962-1.779h.482v-.322h-1.45v.322h.419l-.701 1.295-.71-1.295h.51l-.002-.322h-2.104v.322h.482l.978 1.779zM5.073 10.81H2.968v.322h.481l.98 1.779h1.133l.962-1.779h.482v-.322h-1.45v.322h.418l-.7 1.295-.71-1.295h.509v-.322zm3.707-.044c.975 0 1.498.486 1.498 1.096 0 .618-.494 1.111-1.493 1.111-.999 0-1.497-.493-1.497-1.111 0-.61.517-1.096 1.492-1.096zm.017.33c-.333-.005-.527.348-.534.753-.006.39.15.784.506.79.366.007.524-.39.53-.772.008-.405-.168-.764-.502-.77zm10.738-.33c.974 0 1.497.486 1.497 1.096 0 .618-.493 1.111-1.492 1.111-1 0-1.498-.493-1.498-1.111 0-.61.518-1.096 1.493-1.096zm-.517 1.083c-.007.39.15.784.506.79.366.007.524-.39.53-.772.008-.405-.168-.764-.502-.77-.333-.006-.527.347-.534.752zm2.857-6.667L20.656 6.4A10.26 10.26 0 0 1 22.308 12c0 5.693-4.615 10.308-10.308 10.308S1.692 17.693 1.692 12 6.307 1.692 12 1.692c2.07 0 3.996.61 5.611 1.66l1.219-1.219A11.944 11.944 0 0 0 12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12c0-2.533-.785-4.882-2.125-6.818zM18.036.472v.337c.728.394 1.413.859 2.047 1.382l-1.71 1.71a10.29 10.29 0 0 1 1.735 1.732l1.708-1.708c.524.636.989 1.322 1.384 2.038h.328V.473h-5.492z" },
    // From selfh.st/icons (CC BY 4.0), in their own colours on white; bills simple-icons has, from it.
    "fidelity": { name: "Fidelity", bg: "#FFFFFF", ink: "#111111", kind: "investment", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M256.4 510.8c140.9 0 255.1-113.2 255.1-252.8S397.2 5.1 256.4 5.1C115.5 5.1 1.3 118.3 1.3 258s114.2 252.8 255.1 252.8" style="fill:#fff"/><path d="M218.8 304.4h91.8l26.9 17.4H214.8l-55 170.3c-31.3-12.5-59.7-31.2-83.7-54.8S33 385.5 20 354.5.1 290 0 256.3s6.6-67.1 19.5-98.2C44.9 97.5 92.7 49 153 22.6s128.4-28.5 190.2-5.9c61.8 22.5 112.6 68 141.7 126.9 29.2 59 34.5 126.9 15 189.7-14.7 47.7-43.3 89.9-82.1 121.3l-67.8-113 94.4 52.7s.8-.6 0-1.2l-123-106.7L481 310.8h.8l-1-.9L330 256.6l156.7-37.9v-.8l-160.4 10.5 125.8-95.3s-.8-.8-1.1 0l-141.4 71.7L387.5 67s0-.8-.5 0L285.3 186 305 28.5s-.6-.6-1.1 0l-47 152.7-41-157.5s-.9-.5-1.2 0L226 187.1l-96.8-126h-.9l73.2 139.5-138.3-75.5s-.8 0-.8.6l123.1 101.1L28 210.2c-.6 0-.6.8 0 1.1l152.8 44.6-151.7 44.4-.2.2c0 .1-.1.2-.1.3s0 .2.1.3c0 .1.1.2.2.2l156.4-17.7L62.7 387.4s-.6.6 0 .9l1.6-.6 98.4-51.5 23-36.7H212l-18.2-12.9 60.8-97.6z" style="fill:#368727"/></svg>' },
    "vanguard": { name: "Vanguard", bg: "#FFFFFF", ink: "#111111", kind: "investment", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M8.3 6V.8H181l124 362.1 91.7-290.5s18.7-48.9-31.4-68.2V0h138.4L328.9 512l-72.8-28.1s-58.9-17.4-90.3-105.8L52 63.9S37.6 13.2 8.3 6" style="fill-rule:evenodd;clip-rule:evenodd;fill:#96151d"/></svg>' },
    "schwab": { name: "Charles Schwab", bg: "#FFFFFF", ink: "#111111", kind: "investment", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M0 512h512V0H0z" style="fill-rule:evenodd;clip-rule:evenodd;fill:#009cdb"/><path d="M444.9 232c0-7-4.3-12.8-8.2-17.9-3.3-4.4-6.4-8.5-6.4-12.7 0-5.7 3.2-9.4 8.2-9.4 2.5 0 4.5.9 6.5 1.9 2 .9 4.1 1.9 6.7 1.9 3.5 0 6.6-3.7 6.6-6.6 0-3.5-3.7-7.2-10-7.2-14.3 0-27.1 16.2-27.1 29 0 7 4.2 12.4 8 17.2 3 3.9 5.6 7.2 5.6 10.6 0 5.7-5.3 9.2-10.4 9.2s-8.7-3.2-11.5-5.8c-2.1-1.9-4-3.6-5.9-3.6-2.8 0-3.4 5.9-3.4 7.9 0 3.3 6.8 8.8 14.6 8.8 11.8.1 26.7-10.9 26.7-23.3m-312.4-90c-.3 0-.6.3-.6.6v3.4c0 .2.2.5.4.6l2.1.2 2.7.2c3.5.6 4.4 1.2 4.4 2.9 0 2.9-3.3 12.1-7.8 24.9l-4.1 11.5c-3.5 10.1-8.9 24.3-13.7 36.8-5.7 14.9-10.2 26.7-10.2 28.3 0 1.9 1 2.4 5.2 2.4 4.6 0 6.7-.7 7.2-2.5 8-26.4 30.1-56.6 41.5-56.6 3.6 0 4.9 1.3 4.9 4.8 0 5.9-5 16.9-9.8 27.6-4.2 9.4-8.3 18.3-8.3 22.5 0 3.9 1.7 5.8 5.2 5.8 11.3 0 19.9-10.2 26.7-18.4l1-1.2.2-.4-.2-.4-2.3-2.8c0-.1-.2-.2-.3-.2-.2 0-.4 0-.5.2-3.9 4.1-10.4 10.2-12.3 10.5-.5 0-.9 0-1.1-.2-.3-.3-.3-.8-.2-1.8.1-.9 1.3-3.8 3-7.8 4.3-10.4 11.5-27.7 11.5-38 0-8.2-3.9-13-10.8-13-13.8 0-25 15.8-30.3 23.4-1.2 1.8-2.4 3.4-2.7 3.5-.1 0-.2 0-.2-.1-.2-.3.5-2.1 2-5.4 1.5-3.5 3.8-8.7 6.9-16.8 10.4-27.1 14.8-41.6 14.8-42.8 0-1.6-1.5-1.8-3-1.8h-21.3zm-30.4 96.7c.1-.2.1-.5-.1-.6l-2.4-2.5c0-.1-.2-.2-.4-.2-.1 0-.3 0-.3.1l-.3.3c-4.3 4-12.6 10.7-20.1 11.2-2.9.2-5.5-.7-7.5-2.4-2.5-2.1-3.9-5.6-4.1-9.9-.5-11.2 9-28.1 18.5-38 5.1-5.3 9.8-8.3 13.2-8.3 4 0 6.4 2.9 8.8 5.8 2.1 2.5 4.1 4.8 6.9 4.8 1.1 0 2.3-.6 3.2-1.5 1-1.1 1.5-2.4 1.5-3.8-.2-4.4-4.2-11.3-14.2-11.5-11.4-.2-25.6 6.7-36.2 17.7-10.1 10.4-15.4 22.8-14.8 34.7.4 10.1 5.9 20.8 19.8 20.8 14-.1 26.4-12.7 28.5-16.7m184.3-25.6c-.3.6-1.1 2.2-1.3 2.1h-.2v-.5c0-.7.8-3.6 1.6-7.3 1.7-7 4-16.6 4-19.4 0-3.6-2-5.6-5.6-5.6-7.5 0-18.9 12.4-22.9 19-.1 0-.1.1-.1.3v.1c0 .1.1.3.2.4l2.3 2.3c.1.1.2.2.4.2s.4-.1.5-.3l.7-.7.6-.7c2.6-3.2 7.9-9.9 10.6-9.9 1.5 0 2.3 1.5 2.3 4.2 0 6.7-7.3 27-12.2 40.5-2.8 7.6-4.7 13.1-4.7 14.2 0 1.5.6 2.1 1.8 2.1h6.3c1.3 0 1.8-.8 2.7-2.8 0-.1 3.1-7.4 4.9-11 12.5-25.6 19.4-38.7 24.7-43.8 3.5-3.4 6-4.9 7.8-4.8 1.4.1 2.3 1.1 3.2 2.2 1 1.2 2 2.5 3.9 2.6 1.3.1 2.5-.4 3.5-1.3 1.6-1.5 2.5-4 2.5-6.8 0-4.7-3.3-6.3-6.1-6.3-11.6-.1-20.1 8.3-31.4 31m-89.8 24.3c0-20.7 16.4-49.4 32.6-49.4 5.4 0 8.4 3.1 8.4 8.6 0 8.5-22.4 47.8-36.4 47.8-2.8.1-4.6-1.1-4.6-7m50.3-56.7c-1 .3-1.6 1.2-2.2 2.1-.7 1-1.3 2-2.5 2-1 0-2.1-.2-3.3-.5-1.7-.3-3.8-.8-6.6-.8-31.7 0-48.3 42.6-48.3 57.3 0 10 5.5 14.5 10.9 14.5 6.8 0 16-2.3 27.6-20.1 0 0 2.6-4.3 2.9-4.3.1 0 .2 0 .3.1s.1.4 0 .8l-.9 2.1c-1.5 3.2-4.2 9-4.2 14.4 0 2.6.6 4.5 1.9 5.7 1.1 1.1 2.6 1.6 4.5 1.6 11-.2 20.5-14.4 24.1-19.7l.1-.3-.1-.4-2.4-2.8c-.3-.3-.6-.2-.9 0l-2.5 3c-3.2 4.1-7.3 9.1-9.8 9.1-.6 0-.9-.1-1.1-.3-.3-.3-.4-.9-.3-2.1.2-3.4 6.9-21 12.2-35.1 4-10.4 7.4-19.4 7.5-20.9 0-.3 0-1.4-1-1.9l-4.3-2.9-.2-.1c-.3-.4-.9-.7-1.4-.5m150 6c3.6 0 6.1 2.5 6.1 6 0 8.7-10.1 13.9-27.6 14.2 3.2-5.9 12.7-20.2 21.5-20.2M350 235.4c0 11.8 7.7 20 18.7 20 13 0 26.7-12.4 30-16.7.2-.2.1-.5-.1-.7l-2.1-2.6c-.3-.2-.6-.2-.8-.1l-1.8 1.3c-4.3 3.2-12.3 9.2-18.1 9.2-7.3 0-11.8-4.6-11.8-12.1 0-9 4.4-15.8 7.6-20.7 0 0 .3-.5.4-.6.2 0 1.2.1 1.2.1l6.8.2c11.8 0 33.9-5.6 33.9-19.2 0-5.6-5.2-11.5-14.8-11.5-20.2.1-49.1 27.7-49.1 53.4m-5.9.8c.2-.3.1-.5 0-.6 0-.1-2.5-3.2-2.5-3.2-.1-.1-.3-.2-.4-.2-.2 0-.3.1-.4.2l-.8.9c-6.2 6.8-9.6 10.6-12.4 10.7-.3 0-.8 0-1.2-.4q-.6-.6-.6-2.1c.2-3.8 6.4-21.6 18.9-54.6l9.1-23.6c4.8-12.3 7.2-18.5 7.2-19.3 0-.5-.1-1-.4-1.3-.4-.5-1.3-.7-2.5-.7H337c-.3 0-.6.2-.6.6l-.1 3.4c0 .3.2.5.4.6l4.7.4c3 .5 4.3 1.5 4.2 3.5-.1 3-13.8 37-13.8 37-7.4 18.3-19.8 50.2-20.2 57.7-.2 3.3.6 6 2.3 7.8 1.5 1.5 3.6 2.3 6.3 2.3 8.7 0 17.3-10.8 23-17.9zm-290.3 64c0 9.9 7.9 15.4 15.6 19.4l3.3 1.6c7.7 3.8 10.9 7.8 10.9 13.8 0 6.8-4.4 11.6-10.7 11.6-10.1 0-15.7-10.5-18.2-16.8l-.1-.2-3.4 1.2v.2c1.1 6.4 2.3 13.3 3.1 16v.1l1.7.6 4.4 1.6c3 1.1 6.8 1.7 10.4 1.7 14 0 23.8-8.7 23.8-21.2 0-11.7-8.9-17-15.7-20.1l-2.7-1.2c-8.6-3.9-12.1-7.7-12.1-13.1 0-5.3 3.2-10.7 10.4-10.7 8.4 0 11.6 6.6 13.6 13.1v.2l3.6-.7v-.2c-.9-5.1-1.6-9.7-2-13.9v-.1l-2.4-.8-2.1-.6c-2.6-.9-6.2-1.5-9.5-1.5-12.8.1-21.9 8.3-21.9 20m48.4 16.7c0 17 11.8 34.2 38.3 34.2 6.8 0 15.8-2 19.5-3.1 1.9-4.2 4.2-12.9 5.3-17.3v-.2l-3.2-.7-.1.1c-5.3 10.8-10.3 16.7-21.6 16.7-14.6 0-24.4-13-24.4-32.4 0-13.5 6.4-29.3 24.4-29.3 10.6 0 16.4 4.5 19.3 15.2v.1l3.3-.4-.5-4.6-1.5-12.1-1.8-.4c-3.5-.8-9.4-2.2-16.8-2.2-23.7-.2-40.2 14.8-40.2 36.4m140.5-35h-29.6v3.2h.2c7.6.6 8.5 1.1 8.5 12.5v13.7h-31.1v-13.7c0-11.4.9-11.9 8.4-12.5h.2v-3.2h-30v3.2h.2c8.8.6 9.4 1.4 9.4 12.5v36.2c0 10.9-.7 11.8-9 12.5h-.1v3.2h30v-3.2h-.2c-7.8-.6-8.8-1.1-8.8-12.5v-17.4h31.1v17.4c0 11-.6 11.8-9.4 12.5h-.2v3.2h30.4v-3.2h-.2c-7.9-.6-8.7-1.1-8.7-12.5v-36.2c0-11 .6-11.8 8.9-12.5h.2v-3.2zm103.7 0h-24v3.2l3.8.3c2.1.2 3.1.6 3.7 1.4.3.5.5 1.1.5 2 0 1.1-.2 2.6-.8 4.6-.2 1-5.9 23.4-10.4 38.4-.9-2.1-18-49-18-49v-.1h-4.3s-15.4 48.4-15.7 49.1c-.7-2.2-12-40.1-12-40.1-.4-1.5-.6-2.6-.6-3.4 0-.7.1-1.1.4-1.5.5-.8 1.7-1.1 3.6-1.4l3.3-.2v-3.3h-28.3v3.2h.2c5.5.6 7.2 1.2 10 10l17.1 55.2h4.9l16.1-48.3c.8 2 17.6 48.2 17.6 48.2l.1.1h4.8v-.1c9.5-32 17.4-54.4 17.5-54.6 3.4-9.4 4.2-9.8 10.7-10.4h.2V282h-.4zm30.8 18.1-7-18.9h-.1l-4.4.5-21.1 54.2c-3.5 9.3-4.7 9.7-11 10.5h-.2v3.2h23.3v-3.2l-3-.4c-2.3-.3-3.4-.7-3.9-1.5-.3-.4-.4-.9-.4-1.5 0-1 .3-2.3.9-4.1l.6-1.7c1.3-4.1 2.9-8.7 4.1-11.4h18.9c2.2 5.6 4.6 11.7 5.6 14.7.4 1.3.7 2.3.7 3 0 .4-.1.7-.2 1-.4.6-1.3 1-3.2 1.3l-3 .5v3.2h27.6v-3.2h-.2c-5.8-.6-7.3-1.1-10.8-10.5zm-13-1.8c.1.3 7.8 21.9 8 22.4h-16c.2-.5 7.9-22.2 8-22.4m65.4 17.2c11.5 0 18 5.6 18 15.4 0 10.5-7.1 14.3-13.7 14.3-3 .1-4.7-.3-5.7-1.3-1.6-1.6-2-4.9-2-10.1v-18.3zm-23.2-33.5h-.2v3.2h.2c7.2.6 8.1 1.1 8.1 12.5v36.2c0 11.3-1 11.9-8.8 12.5h-.2v3.2h25.9c8.3 0 15.3-1.5 19.9-4.1 6.3-3.8 9.4-9 9.4-15.8 0-9.4-6.8-15.8-18.3-17.4 5.1-1.1 14.4-5.5 14.4-15 0-5.4-1.9-9.3-5.9-11.9-4-2.5-8.2-3.4-16-3.4zm19.8 9.3c0-2.4 0-4.1.8-4.5.2-.1 1.3-.5 4.7-.5 3 0 12.9.9 12.9 12.4 0 8.2-5.1 12.7-14.3 12.7h-4v-20.1z" style="fill-rule:evenodd;clip-rule:evenodd;fill:#fefefe"/></svg>' },
    "etrade": { name: "E*TRADE", bg: "#FFFFFF", ink: "#111111", kind: "investment", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M512 308.6H347l82.4 142.8-91 52.5-70.3-121.6 73-126.3-73-126.3L338.4 8.1l91 52.6L347 203.4h165z" style="fill:#0f8ec7"/><path d="M316.7 256 173.6 8.1 82.4 60.7l82.4 142.7H0v105.2h164.8L82.4 451.4l91.2 52.5z" style="fill:#63c"/></svg>' },
    "interactivebrokers": { name: "Interactive Brokers", bg: "#FFFFFF", ink: "#111111", kind: "investment", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><linearGradient id="interactive-brokers_svg__a" x1="2136.942" x2="2363.435" y1="125.81" y2="125.81" gradientTransform="rotate(180 1244.122 256.5)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#d81222"/><stop offset="1" style="stop-color:#960b1a"/></linearGradient><path d="M351.3 512H124.8V262.4z" style="fill:url(#interactive-brokers_svg__a)"/><path d="M319.4 256c37.4 0 67.8 30.3 67.8 67.8s-30.3 67.8-67.8 67.8-67.8-30.3-67.8-67.8S282 256 319.4 256M351.3 0 124.8 262.4V512z" style="fill:#d81222"/></svg>' },
    "traderepublic": { name: "Trade Republic", bg: "#FFFFFF", ink: "#111111", kind: "investment", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M168.7 71.3 0 126v156.7L168.7 228c13.3-4 27.3-4 40.7.7l62 21.3c13.3 4.7 27.3 4.7 40.7.7L511.3 196V39.3L312 94c-13.3 4-27.3 4-40.7-.7l-62-21.3c-12.6-4-27.3-4.7-40.6-.7m0 190L0 316v156.7L168.7 418c13.3-4 27.3-4 40.7.7l62 21.3c13.3 4.7 27.3 4.7 40.7.7L512 386V229.3L312.7 284c-13.3 4-27.3 4-40.7-.7L210 262c-13.3-4-28-4.7-41.3-.7" style="fill-rule:evenodd;clip-rule:evenodd"/></svg>' },
    "capitalone": { name: "Capital One", bg: "#FFFFFF", ink: "#111111", kind: "bank", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M57 34.8c67.4-4.4 135-7.1 202.6-5.3 48.2 1.6 96.6 4.8 143.9 14.5 26.7 5.9 53.7 13.4 77 28.1 14 9 27.6 21.7 30.6 38.8 3.7 19.9-4.5 39.4-14.5 56.2-18.7 30.1-44.1 55.3-70.2 78.9-32.9 29.2-68 55.9-103.9 81.3-35.3 24.5-70.7 48.9-106.6 72.4-45.8 29.4-92.7 57.2-140.4 83.4H10.6c33.1-23 64.3-48.7 94.8-75.1 37.6-32.5 74.1-66.3 109.8-100.9 7-6.7 14.5-13 19.7-21.2 17-23.8 32.7-51.3 31.9-81.5-.5-20.7-11.7-39.7-27-52.9-25.2-21.6-57.3-32.6-88.9-41-31.9-8.1-64.6-12.6-97.3-16.1-17.9-1-35.7-3.5-53.6-3.6V39.3c18.9-2.3 38-3.1 57-4.5" style="fill:#cc2427"/></svg>' },
    "citi": { name: "Citi", bg: "#FFFFFF", ink: "#111111", kind: "bank", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="m156 357.4-.9.9c-14.5 15.3-32.3 23-49.3 23-36.6 0-63.8-27.2-63.8-65.5s26.4-65.5 63.8-65.5c17.9 0 34.9 7.7 49.3 23l.9.9 23.8-28.9-.9-.9c-19.6-23-43.4-34.9-72.3-34.9s-56.1 10.2-74.8 27.2C10.5 256.3.3 282.6.3 314.9s11.1 58.7 31.5 78.2c19.6 17.9 45.9 27.2 74.8 27.2s52.7-11.1 72.3-34.9l.9-.9zm47.5 59.9h41.7V213.2h-41.7zm206-44.9q-16.65 10.2-30.6 10.2c-13.6 0-19.6-6.8-19.6-23v-108h42.5v-38.3h-42.5v-63.8l-41.7 22.1v41.7h-34.9v38.3h35.7v114.8c0 31.5 18.7 52.7 46.8 53.6 18.7 0 30.6-5.1 37.4-9.4h.9l10.2-39.1zm34.6 44.9h41.7V213.2h-41.7z" style="fill:#004685"/><path d="M510.3 176.9C472.1 123.4 408.3 91 343.7 91s-127.5 32.3-165.8 86.7l-1.7 2.6h48.5l.9-.9c32.3-34 75.7-51.9 119-51.9s86.7 17.9 119 51.9l.9.9H513z" style="fill:#ee1c25"/></svg>' },
    "usbank": { name: "U.S. Bank", bg: "#FFFFFF", ink: "#111111", kind: "bank", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="m0 364.9 256 103 256-103V44.1H0z" style="fill:#cf2a36"/><path d="M194.7 321.7C183.6 340.3 159 348 137.4 348c-52.2 0-81.5-38-81.5-83.6V128.9h65.6v121.6c0 20.7 11.2 37.1 34.5 37.1 22 0 35.8-15.1 35.8-36.6V128.9h65.6v176q0 19.2 2.1 38.4h-62.9c-1.2-7.2-1.8-14.4-1.9-21.6m144.1-49.1c.9 14.7 11.2 28.9 33.7 28.9 16.8 0 25-9.1 25-18.5 0-7.8-5.2-14.2-21.1-17.7l-24.6-5.9c-45.7-9.7-63.8-35.5-63.8-65.7 0-39.2 34.5-71.2 82.4-71.2 62.1 0 83.7 38.8 85.8 63.9l-54.4 9.9c-1-15.5-14.5-27.2-30-26.2h-.6c-12.5 0-23.5 7.4-23.5 18.5 0 9.1 7.4 14.2 16.8 15.9l28.5 5.9c44.4 9 65.9 35.8 65.9 67.2 0 36.7-28 72.4-85.3 72.4-67.3 0-88.8-43.5-90.6-67.3z" style="fill:#fff"/></svg>' },
    "sofi": { name: "SoFi", bg: "#FFFFFF", ink: "#111111", kind: "bank", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M430.6 21.7c32.5 0 58.1 25.6 58.1 58.1s-25.6 58.1-58.1 58.1-58.1-25.6-58.1-58.1 25.5-58.1 58.1-58.1m0-20.9c-44.1 0-81.3 37.2-81.3 81.3s37.2 81.3 81.3 81.3 81.3-37.2 81.3-81.3S474.7.8 430.6.8m-39 183.9c39.5-21.5 88.8-6.9 110.3 32.6s6.9 88.8-32.6 110.3-88.9 6.9-110.3-32.6c-21.5-39.4-6.9-88.8 32.6-110.3m-.2 174.3c39.5-21.5 88.8-6.9 110.3 32.6s6.9 88.8-32.6 110.3-88.8 6.9-110.3-32.6c-21.4-39.4-6.8-88.8 32.6-110.3M256.3 198.3c16.3 0 30.2 7 41.8 16.3 11.6 11.6 16.3 25.6 16.3 41.8 0 32.5-25.6 58.1-58.1 58.1-16.3 0-30.2-7-41.8-16.3-11.6-11.6-16.3-25.6-16.3-41.8-2.3-32.5 25.6-58.1 58.1-58.1m0-23.2c-44.1 0-81.3 37.2-81.3 81.3s37.2 81.3 81.3 81.3 81.3-37.2 81.3-81.3-37.2-81.3-81.3-81.3M7.1 222.8c18.2-41.1 66.2-59.6 107.3-41.4s59.6 66.2 41.4 107.3-66.2 59.6-107.3 41.4-59.6-66.2-41.4-107.3M181.7 48.6C199.9 7.6 248-11 289 7.2s59.6 66.2 41.4 107.3-66.2 59.6-107.3 41.4-59.6-66.2-41.4-107.3M7.3 48.4C25.5 7.3 73.6-11.2 114.6 7s59.6 66.2 41.4 107.3-66.2 59.6-107.3 41.4S-10.9 89.5 7.3 48.4m174 349c18.2-41.1 66.2-59.6 107.3-41.4s59.6 66.2 41.4 107.3-66.2 59.6-107.3 41.4c-41-18.2-59.6-66.2-41.4-107.3M82 372.6c16.3 0 30.2 7 41.8 16.3 11.6 11.6 16.3 25.6 16.3 41.8 0 32.5-25.6 58.1-58.1 58.1s-58.1-25.6-58.1-58.1c-2.3-32.6 25.6-58.1 58.1-58.1m0-23.3C37.9 349.3.7 386.5.7 430.6S37.9 512 82 512s81.3-37.2 81.3-81.3-37.1-81.4-81.3-81.4" style="fill:#00a2c7"/></svg>' },
    "navyfederal": { name: "Navy Federal", bg: "#FFFFFF", ink: "#111111", kind: "bank", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M403 444.7h-7.6c17.8-20.2 32.7-44.3 43.9-71.2h25.2c-15.8 27.7-36.7 51.8-61.5 71.2m-23.3 16.2q-.15 0 0 0M47.6 373.5h25.2c11.2 26.9 26.2 51 44 71.2H109c-24.8-19.4-45.8-43.5-61.4-71.2m61.3-306.3h7.8c-13.3 15-25.1 32.3-34.9 51.4h-.2l-3.4 7.3-3.5 7.3.3.1c-.8 1.7-1.6 3.4-2.3 5.1H47.6c4.2-7.4 8.7-14.6 13.6-21.6 13.6-18.9 29.7-35.6 47.7-49.6m270.8-16.1c-.1 0 0 0 0 0m84.7 87.3h-25.2c-11.2-26.9-26.1-51-43.9-71.2h7.6c24.9 19.5 45.8 43.6 61.5 71.2M462.3 264h32.9c-1.1 33.2-9 64.9-22.4 93.4h-27.3c10.1-28.7 15.9-60.3 16.8-93.4M366 357.4c5.6-28.7 8.9-60.2 9.3-93.4H446c-.9 33.2-7.1 64.9-17.7 93.4zm-37.6 103.5h26.5c-14.3 10.9-29.7 19.5-46.1 25.5 6.9-7.2 13.5-15.7 19.6-25.5m-144.8 0c6 9.8 12.6 18.3 19.5 25.5-16.3-6-31.8-14.6-46-25.5zM65.9 264h70.8c.4 33.2 3.8 64.7 9.4 93.4H83.6C73 328.9 66.8 297.3 65.9 264m-16.2-16.1H17c1-32.6 8.6-64.2 22.3-93.3h27.2c-10.2 29.4-15.9 61-16.8 93.3m96.5-93.3c-5.8 29.3-9 61-9.5 93.3H66c.9-32.4 6.9-64.2 17.7-93.3zM328.4 51.1c-6.1-9.8-12.7-18.4-19.6-25.5 16.4 6 31.8 14.6 46.1 25.5zM264 247.9v-93.3h85.2c5.9 28.7 9.4 60.3 9.9 93.3zm0 109.5V264h95.1c-.5 33-4 64.7-9.9 93.4zm0 87.3v-71.2h81.4c-6.8 27.5-15.9 51.7-26.7 71.2zm0 16.2h44.8c-13.3 19-28.6 31.1-44.8 34.2zm-16.1 0V495c-16.2-3.1-31.4-15.2-44.8-34.2h44.8zm0-87.4v71.2h-54.7c-10.7-19.5-19.9-43.7-26.7-71.2zm0-109.5v93.4h-85.1c-5.9-28.7-9.4-60.4-9.9-93.4zm0-109.4v93.3h-95c.4-32.4 3.8-64.1 9.8-93.3zm70.9-87.4c10.7 19.5 19.8 43.8 26.7 71.2H264V67.2zM264 51.1V17c16.2 3 31.5 15.1 44.8 34.2H264zM247.9 17v34.1H203C216.7 31.9 232.1 20 247.9 17m-64.2 34.1h-26.1c14.1-10.8 29.3-19.2 45.2-25.2-6.8 7.1-13.2 15.5-19.1 25.2m-15.9 81.6c6.7-25.6 15.4-47.5 25.2-65.4h55v71.2h-81.6c.4-2 .8-4 1.4-5.8m278.3 115.2h-70.7c-.5-33.3-3.7-64.7-9.3-93.3h62.4c10.5 28.5 16.7 60.1 17.6 93.3m49 0h-32.9c-.9-33.1-6.7-64.6-16.8-93.3h27.3c13.5 28.5 21.3 60.1 22.4 93.3m-73.3-109.5h-59.3c-6.3-27-14.8-51-25-71.2h35.8c19.6 19.5 36.2 43.7 48.5 71.2m-329.1-5.6c12.2-25.6 27.9-47.6 46.2-65.5h35.8c-7.8 15.5-14.7 33.4-20.5 53.6l-.1-.1-2.1 7.8-2 7.8h.2c-.2.7-.4 1.4-.5 2.1H90.2c.9-1.9 1.6-3.8 2.5-5.7M16.9 264h32.8c.9 33 6.7 64.6 16.8 93.4H39.3c-13.4-28.5-21.4-60.1-22.4-93.4m73.3 109.5h59.3c6.4 27 14.9 51 25.2 71.2h-35.9c-19.6-19.4-36.2-43.5-48.6-71.2m283 71.2h-35.8c10.2-20.2 18.7-44.2 25-71.2h59.3c-12.2 27.7-28.8 51.8-48.5 71.2M511.5 256C511.5 122.8 409 13.1 278.7 1.6 271.2.5 263.7 0 256 0c-7.2 0-14.3.6-21.4 1.5-71.5 6-137.8 42.2-181.7 99.5l-.2-.2-4.7 6.6-4.7 6.6.2.2C15.5 156.3.5 205 .5 256 .5 389.2 103 498.9 233.3 510.4c7.5 1 15.1 1.6 22.7 1.6 7.7 0 15.2-.5 22.7-1.6C409 498.9 511.5 389.2 511.5 256" style="fill:#003767"/></svg>' },
    "usaa": { name: "USAA", bg: "#FFFFFF", ink: "#111111", kind: "bank", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M32.4 373.7v83.7c0 46.8 29.1 54.5 53.5 54.5 36.1 0 52.7-23.4 52.7-55v-83.3h-23.8v86.1c0 10.9-3.6 31.2-28.9 30.8-23-.4-27.2-21.1-27.2-34.4v-82.4zm205.9 5.5s-15.2-7.4-32.5-7.4c-21.6 0-48.6 10.8-48.6 40.5 0 20.6 15.4 30.3 25.9 35.3 5.6 2.6 12.4 5.6 18 8.6 2.9 1.6 14.4 5.3 14.4 17.5 0 13.1-14.5 17.5-21.1 17.5-23.2 0-39.1-10.4-39.1-10.4l2.4 26.1s9.5 4.7 38 4.8c27.1-.1 46.7-17.2 46.7-40.8 0-18.1-12.6-28.9-23.4-34-8.5-4.1-13.4-6.3-20.7-9.7-7.4-3.4-15-9.3-15-18.4 0-9.8 9.1-16.8 22.5-16.8 19.8 0 27.7 8.8 32.5 11.5zm194.1-5.7h-28.6l4.6 11.3L364 501.2l-46-127.7h-28.6l4.6 11.3L246.6 509h25.9l8.3-23.6h49l8.3 23.6H387l8.3-23.6h49.1l8.3 23.6h28.7zM287.2 467l19-53 17 53zm114.4 0 18.9-53 17 53zM31 221.4l1.2 42.3s10.6-7.7 22.4-7.7c11.9 0 25.2 8.4 25.2 8.4l106.1 60.9 9-38.2-115-66s-13.3-8.3-25.2-8.3c-12-.1-23.7 8.6-23.7 8.6m0-55.3 1.2 42.3s10.6-7.7 22.4-7.7c11.9 0 25.2 8.4 25.2 8.4l117.5 67.4 8.9-38.2-126.3-72.6s-13.3-8.3-25.2-8.3c-12-.1-23.7 8.7-23.7 8.7m0-55.4 1.2 42.3s10.6-7.7 22.4-7.7c11.9 0 25.2 8.4 25.2 8.4l129 74 9-38.2-137.9-79.1s-13.3-8.3-25.2-8.3c-12-.1-23.7 8.6-23.7 8.6m221-67.3 11.8 49.9 161.5 92.6s12.7 8.4 25.2 8.4 23.7-8.7 23.7-8.7l-1.2-42.3s-10.1 7.7-22.4 7.7-25.2-8.4-25.2-8.4l-125-71.7-8.6-32.1c0-1.3 1.2-2 1.7-2.1l21.2-6.5c2.9 0 4.5 2.4 4.5 4.4l1.1 2.3c.8.4 4-1.1 4.2-1.3V23c.1-8.4-6.8-15.9-16.1-15.9h-21.2S284.1 0 275.1 0h-40.2c-10.6 0-13.1 9.8-13.1 9.8l-27.9 110.7L79.8 55s-12.3-8.4-25.2-8.4S31 55.4 31 55.4l1.2 42.3S41.7 90 54.6 90s25.2 8.4 25.2 8.4l140.4 80.5zm15 63.6 11.8 50.2 146.6 84s13.1 8.4 25.2 8.4 23.7-8.7 23.7-8.7l-1.2-42.3s-9.4 7.7-22.5 7.7-25.2-8.4-25.2-8.4zm15 64 11.8 50.2 131.6 75.4s13.1 8.4 25.2 8.4 23.7-8.7 23.7-8.7l-1.2-42.3s-9.3 7.7-22.4 7.7-25.2-8.4-25.2-8.4zm15.1 64 11.8 50.1 116.5 66.8s13.1 8.4 25.2 8.4 23.7-8.7 23.7-8.7l-1.2-42.3s-9.4 7.7-22.4 7.7c-13.1 0-25.2-8.4-25.2-8.4z" style="fill:#1a3258"/></svg>' },
    "mtbank": { name: "M&T Bank", bg: "#FFFFFF", ink: "#111111", kind: "bank", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M356.3 212.7h11.2s-.1-39.9 36.4-39.9H415v164.1h-17.5c-11.2-1.1-20.5-8.3-29.4-16.8L355 307.4c2.9-3.9 6.7-9.8 9.3-15.9 3-7 5.2-20 6.6-23.2.5-1.1.9-2 1.6-3 1.7-2.7 4.6-5 7.6-6.3 2.3-1 5-1.6 7.5-1.6h1.7v-9.5h-54.7v9.5h3.7c10 0 18.1 8.1 18.1 18.2 0 13-9.8 23.7-9.8 23.7l-50-48.6c22.3-8.1 41.1-19.3 41.1-40.3 0-22.1-16.9-37.6-47.3-37.6-30.9 0-51.4 17.1-51.4 44.6 0 18.2 8.3 30 16.4 38.1-25.4 9.8-40.5 22.8-40.5 46.4 0 33.3 30 46.6 63.3 46.6 21.9 0 40.3-6.6 54.5-17.1.2-.2 9.5 14.9 36.8 14.9 2 0 103.9-.1 103.9-.1v-9.4h-20V172.7h11.1c36.4 0 36.4 39.9 36.4 39.9H512v-49.2H356.3zm-67-30.6c12.1 0 19.5 9.7 19.5 23.5 0 15.3-6.8 28.5-21.4 36.4-9.4-9.2-17.5-21.7-17.5-36.8-.1-13.6 7.4-23.1 19.4-23.1m-1.1 150.5c-21.6 0-37.8-16-37.8-37.5 0-15.1 3.5-24.3 13.6-30.8l60.4 59.3c-9.9 6.8-22.6 9-36.2 9m-91.8-159.8H218v-9.3h-58.3S111.4 284 109.9 287.9c-1.6-3.9-50.1-124.4-50.1-124.4H0v9.4h21.6v164H3.7v9.3h52.8v-9.3H33.1V193.7C35.8 200.6 91.9 342 91.9 342h9.5s55.3-141.4 58.1-148.3c0 7.7-.1 143.2-.1 143.2H141v9.3h73.9v-9.3h-18.5z" style="fill:#027856"/></svg>' },
    "redstone": { name: "Redstone Federal Credit Union", bg: "#FFFFFF", ink: "#111111", kind: "bank", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" id="redstone-federal-credit-union_svg__Layer_1" x="0" y="0" version="1.1" viewBox="0 0 512 512"><style>.redstone-federal-credit-union_svg__st1{fill:#f99b1c}</style><linearGradient id="redstone-federal-credit-union_svg__SVGID_1_" x1="49.4" x2="462.7" y1="510.8" y2="510.8" gradientTransform="translate(0 -255)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#e32a26"/><stop offset=".04" style="stop-color:#e32a26"/><stop offset=".11" style="stop-color:#e52f29"/><stop offset=".33" style="stop-color:#eb3b32"/><stop offset=".55" style="stop-color:#ee4036"/><stop offset=".68" style="stop-color:#ea3d35"/><stop offset=".81" style="stop-color:#de3633"/><stop offset=".93" style="stop-color:#cb2930"/><stop offset="1" style="stop-color:#bd202e"/></linearGradient><path d="M52.5 285.5s-3.2 46.9 41.3 110.9c44.5 64.1 162.1 107.8 162.1 107.8S373.6 460.4 418 396.4c44.5-64.1 41.3-110.9 41.3-110.9v-250L255.9 7.4 52.5 35.5z" style="fill:url(#redstone-federal-credit-union_svg__SVGID_1_)"/><path d="m255.9 512-2.5-.9c-4.9-1.8-120.3-45.2-165.6-110.5C42.4 335.2 45.1 287 45.3 285V29.2L256 0l1 .1 209.8 29-.3 263.6c-.9 16.3-7.1 56.8-42.5 107.8-45.2 65.1-160.7 108.7-165.6 110.5zM59.8 41.8v243.7c0 .9-2.3 46 40 106.8 39.2 56.4 138.9 97.4 156.1 104.2 17.2-6.8 117.1-47.9 156.1-104.2 42.3-60.9 40.1-105.9 40-106.3l-.5-7.7h.6V41.8L256 14.7zm184.3-17.2C217.3 26.8 103 43.3 66.4 48.1l2.1 247.8s4.4 103.7 125 162.4l-5-81.5L292 473.1c50.5-24.9 85.8-51.4 108-77.1-91.3-39.2-144.5-134.7-144.5-134.7 54.6-2.1 83.5-50.5 86.7-79 6.3-57.4-5.6-158.2-89-158.2-3 0-6 .2-9.1.5" class="redstone-federal-credit-union_svg__st1"/><path d="M244.1 24.6C217.3 26.8 103 43.3 66.4 48.1l2.1 247.8s4.4 103.7 125 162.4l-5-81.5L292 473.1c50.5-24.9 85.8-51.4 108-77.1-91.3-39.2-144.5-134.7-144.5-134.7 54.6-2.1 83.5-50.5 86.7-79 6.3-57.4-5.6-158.2-89-158.2-3 0-6 .2-9.1.5" style="fill:#fdb913"/><path d="m291.8 474.8-101.6-94.6 5 80.4-2.1-1C73 401.1 67.3 297 67.2 295.9L65 46.9l1.2-.2c11.3-1.5 30.1-4.1 51.4-7 48-6.7 107.7-15 126.3-16.5 3.7-.3 6.5-.4 9.2-.4 24.5 0 44.7 8.6 59.9 25.6 29.7 33.1 35 92.9 30.5 134.1-3.4 30.7-32.9 76.8-85.7 80.1 8.1 13.6 60.1 96.7 142.7 132.2l1.7.7-1.2 1.4c-24.1 27.8-60.6 53.9-108.5 77.4zM187 373.5l105.2 98c46.4-22.9 81.9-48.1 105.6-75-89.6-39.3-142.9-133.6-143.5-134.5l-1.1-1.9 2.2-.1c52.6-2.1 82-47.6 85.4-77.8 4.4-40.6-.7-99.5-29.8-131.9-14.7-16.4-34.2-24.7-57.9-24.7-2.6 0-5.4.1-8.9.4-18.5 1.5-78.2 9.8-126.1 16.5-20.6 2.9-38.8 5.4-50.3 6.9L69.9 296c0 1 5.7 102.3 122.1 160.2z" class="redstone-federal-credit-union_svg__st1"/><path d="m192.7 66.4 8.2 66 42.7-44.8-29.5 54.3 53.8-9-48.8 24.5 66.7 30.5-71.7-15.1 18.7 37.3-31.9-27.7-8.2 53.9-8-53.9-54.5 60.8 41.3-70.4-53.8 8.9 48.8-24.3-40.9-22 45.9 6.5-25.2-48.4 38.4 38.9z" style="fill:#fff"/></svg>' },
    "disneyplus": { name: "Disney+", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M361.9 296.9c-7.1 1.6-25.7 2.6-25.7 2.6l-2.4 7.4s9.3-.8 16.1-.1c0 0 2.2-.2 2.5 2.5.1 2.6-.2 5.3-.2 5.3s-.1 1.7-2.5 2.1c-2.6.4-20.1 1.1-20.1 1.1l-2.9 9.6s-1 2.2 1.3 1.6c2.2-.6 20.6-4 23-3.5 2.6.6 5.4 4 4.6 7.2-1 3.8-19.3 15.6-30.5 14.7 0 0-5.9.4-10.8-7.5-4.6-7.5 1.8-21.8 1.8-21.8s-2.9-6.7-.8-8.9c0 0 1.3-1.1 4.9-1.4l4.5-9.3s-5.1.3-8.2-3.4c-2.9-3.6-3.1-5.2-.9-6.2 2.3-1.1 23.6-5 38.3-4.5 0 0 5.1-.5 9.5 8.4-.1-.3 2.1 3.3-1.5 4.1m-55.2 35.8c-1.9 4.4-6.8 9.2-13 6.2-6.1-3-15.8-22.8-15.8-22.8s-3.7-7.4-4.4-7.2c0 0-.8-1.4-1.3 6.6s.1 23.8-3.1 26.2c-3.1 2.5-6.7 1.5-8.7-1.4-1.7-2.9-2.5-9.6-1.5-21.6 1.1-11.9 3.9-24.6 7.4-28.6 3.5-3.9 6.4-1.1 7.5 0 0 0 4.7 4.3 12.5 16.9l1.4 2.3s7.1 11.9 7.8 11.9c0 0 .6.5 1.1.1.7-.2.4-4 .4-4s-1.5-12.9-7.9-34.9c0 0-1-2.8-.3-5.3.6-2.6 3.2-1.4 3.2-1.4s10 5 14.9 21.4 1.7 31.1-.2 35.6m-49.3-42c-.8 1.7-1.3 4.1-5.6 4.7 0 0-40.5 2.8-42.4 5.6 0 0-1.4 1.7.8 2.2 2.2.4 11.4 1.7 15.8 1.9 4.7 0 20.7.2 26.4 7.3 0 0 3.4 3.4 3.2 11.1-.1 7.9-1.5 10.6-4.6 13.5-3.2 2.7-30.7 15-48.4-3.9 0 0-8.2-9.1 2.8-16 0 0 7.9-4.8 28 .8 0 0 6.1 2.2 5.8 4.4-.3 2.4-5 4.9-11.8 4.7-6.6-.2-11.4-3.3-10.5-2.9.9.3-7.1-3.8-9.5-1-2.5 2.6-1.9 4.2.5 5.9 6.2 3.5 29.9 2.3 37-5.6 0 0 2.8-3.2-1.5-5.8-4.3-2.5-16.5-3.9-21.3-4.2-4.6-.2-21.6 0-24.1-4.5 0 0-2.5-3.1.2-11.7 2.9-9.1 22.7-12.5 31.2-13.3 0 0 23.6-.8 27.9 4 .2 0 .8 1.2.1 2.8m-66.9 53.1c-2.9 2.1-8.9 1.2-10.6-1.2-1.7-2.1-2.3-10.5-2-23.7.3-13.3.6-29.9 3.5-32.5 3.1-2.7 4.9-.3 6.1 1.5 1.3 1.8 2.8 3.7 3.1 7.9s1.3 26.1 1.3 26.1 1.3 19.8-1.4 21.9m6.1-70.8c-8.3 2.8-14 1.8-18.8-.2-2.1 3.7-3.3 4.8-5 5.1-2.4.2-4.5-3.5-4.9-4.8-.4-.9-1.5-2.5-.1-6.2-4.7-4.2-5.1-9.9-4.3-13.8 1.2-4.4 9.2-21.3 33.4-23.2 0 0 11.9-.9 13.9 5.5h.3s11.5 0 11.3 10.3c-.1 10.1-12.8 22.9-25.8 27.3M174 250.2c-2.5 3.9-2.6 6.3-1.4 7.9 2.8-4.3 7.9-11 15.5-16.1-5.9.5-10.8 3-14.1 8.2m33.5-6.6c-7.6 1.1-19.4 11.4-25 19.7 8.6 1.6 23.8 1 30.6-12.7-.2 0 3.1-8.5-5.6-7m207.1 79.3c-4.6 8-17.4 24.6-34.5 20.7-5.7 13.7-10.4 27.6-13.1 48.3 0 0-.6 4-3.9 2.6-3.3-1.2-8.8-6.7-9.9-14.3-1.2-10 3.3-27 12.4-46.5-2.7-4.3-4.5-10.5-2.9-19.3 0 0 2.3-16.3 18.7-31.1 0 0 2-1.7 3.1-1.2 1.3.5.7 5.9-.3 8.4-1 2.6-8.4 15.3-8.4 15.3s-4.6 8.6-3.3 15.3c8.6-13.2 28.2-40 40.4-31.5 4.1 2.9 6 9.3 6 16.1-.3 6.1-1.7 12.4-4.3 17.2M411 302s-.7-5.3-5.8.5c-4.4 4.9-12.4 14.1-18.8 26.5 6.7-.7 13.2-4.4 15.2-6.3 3.2-2.8 10.6-10.5 9.4-20.7m-238.9 6.6c-.9 11.9-5.5 31.9-37.9 41.8-21.4 6.4-41.6 3.3-52.7.5-.2 4.4-.7 6.2-1.4 7-.9.9-7.9 5-11.8-.7-1.7-2.7-2.6-7.6-3.1-12-24.8-11.4-36.2-27.9-36.7-28.6-.5-.5-6.2-6.4-.5-13.7 5.3-6.5 22.7-13.1 38.3-15.7.5-13.4 2.1-23.5 4-28.1 2.3-5.4 5.1-.5 7.6 3.1 2.1 2.7 3.3 14.4 3.4 23.7 10.2-.5 16.3.2 27.7 2.3 14.9 2.7 24.8 10.3 23.9 18.9-.6 8.5-8.4 12-11.4 12.2-3.1.2-7.9-2-7.9-2-3.3-1.6-.2-3 3.7-4.7 4.3-2.1 3.3-4.3 3.3-4.3-1.6-4.7-20.9-8-40.1-8-.1 10.6.4 28.1.7 38.4 13.4 2.6 23.5 2.1 23.5 2.1s49-1.4 50.5-32.7-48.9-61.4-86.1-71c-37.2-9.7-58.3-3-60.1-2-2 1-.1 1.3-.1 1.3s2 .3 5.5 1.5c3.7 1.2.8 3.1.8 3.1-6.3 2-13.5.7-14.9-2.2s.9-5.5 3.6-9.3c2.7-3.9 5.6-3.8 5.6-3.8 46-15.9 102.1 12.9 102.1 12.9 52.5 26.7 61.5 57.9 60.5 70M33.2 307c-5.2 2.6-1.6 6.2-1.6 6.2 9.8 10.5 21.8 17.1 33.3 21.2 1.3-18.2 1.1-24.6 1.3-33.7-17.9 1.3-28.2 4.2-33 6.3m478.8-3.7v6.5c0 1.4-1.1 2.6-2.6 2.6h-31v4.4c0 9.6-.4 17.4-1.3 26.2-.1 1.3-1.2 2.3-2.5 2.3H468c-.7 0-1.3-.3-1.8-.8-.4-.5-.7-1.2-.6-1.9.9-8.8 1.4-16.5 1.4-25.9v-4.4h-30.6c-1.4 0-2.6-1.1-2.6-2.6v-6.5c0-1.4 1.1-2.6 2.6-2.6h30.2c-.6-10.6-1.9-20.8-4-31.1-.1-.6 0-1.3.4-1.8s1-.8 1.6-.8h7.2c1.1 0 2.1.8 2.3 1.9 2 10.7 3.3 21.1 3.9 31.7h31.3c1.5.2 2.7 1.4 2.7 2.8" style="fill:#01147c"/><radialGradient id="disney-plus_svg__a" cx="463.589" cy="533.713" r="374.058" gradientTransform="translate(0 -279)" gradientUnits="userSpaceOnUse"><stop offset=".007" style="stop-color:#021192"/><stop offset=".03" style="stop-color:#021096"/><stop offset=".057" style="stop-color:#010cb4"/><stop offset=".084" style="stop-color:#0008ce"/><stop offset=".111" style="stop-color:#0006d7"/><stop offset=".138" style="stop-color:#0004e1"/><stop offset=".165" style="stop-color:#0001fa"/><stop offset=".191" style="stop-color:#0000fe"/><stop offset=".216" style="stop-color:#0f1eff"/><stop offset="1" style="stop-color:#0ff;stop-opacity:0"/></radialGradient><path d="M469.9 251.8c-16-39.3-43-72.8-78.1-96.9-36-24.7-78.1-37.7-121.9-37.7-72.4 0-139.7 36-179.8 96.3-.4.6-.5 1.5-.3 2.2.2.8.8 1.3 1.6 1.6l5.6 1.9c.3.1.7.1 1 .1 1 0 2-.5 2.6-1.4 18.4-27.1 43.3-49.6 72-65.1 29.7-16 63.3-24.6 97.2-24.6 41 0 80.5 12.1 114.4 34.9 33 22.3 58.7 53.4 74.2 90 .4 1.1 1.5 1.8 2.7 1.8h6.7c.8 0 1.5-.4 1.9-1s.5-1.4.2-2.1m-372-34.2c-.1 0-.3 0-.4-.1.1 0 .2.1.4.1.1 0 0 0 0 0m361.7 36.5c.1.1.3.2.4.2-.1-.1-.3-.1-.4-.2" style="fill:url(#disney-plus_svg__a)"/></svg>' },
    "hulu": { name: "Hulu", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M113.8 234.7c8.5 6.9 12.7 17.6 12.7 32.3v73.5H86.2v-68.1q0-4.5-3.3-7.8t-7.8-3.3H51.5c-3 0-5.5 1.1-7.6 3.3s-3.2 4.8-3.2 7.8v68.1H0V171.6h40.7v55c.6-.2 2.1-.6 4.5-1.3 2.3-.6 5.4-1 9.2-1h26.1c13.7.1 24.9 3.5 33.3 10.4M242 224.4h40.7v71.2c0 13.4-3.7 24.2-11 32.4-7.3 8.3-17.2 12.4-29.7 12.4h-40.1c-14 0-25.2-3.9-33.5-11.6-8.4-7.7-12.6-18.8-12.6-33.2v-71.2h40.7v68.1c0 3 1.1 5.5 3.2 7.6s4.7 3.2 7.6 3.2h23.5c3 0 5.6-1.1 7.8-3.2s3.3-4.7 3.3-7.6zm71.6-52.8h40.7v168.9h-40.7zM512 224.4v71.2c0 13.4-3.7 24.2-11 32.4-7.3 8.3-17.2 12.4-29.7 12.4h-39.8c-14.2 0-25.5-3.9-33.9-11.6S385 310 385 295.6v-71.2h40.7v68.1c0 3 1.1 5.5 3.2 7.6s4.7 3.2 7.6 3.2h23.9c3 0 5.5-1.1 7.6-3.2s3.2-4.7 3.2-7.6v-68.1z" style="fill:#1ce783"/></svg>' },
    "peacock": { name: "Peacock", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M421.7 357.4c-18 0-32.7 14.7-32.7 32.7s14.7 32.7 32.7 32.7 32.7-14.7 32.7-32.7-14.7-32.7-32.7-32.7" style="fill:#069de0"/><path d="M421.7 268.1c-18 0-32.7 14.7-32.7 32.7s14.7 32.7 32.7 32.7 32.7-14.7 32.7-32.7c-.4-18.4-14.7-32.7-32.7-32.7" style="fill:#6e55dc"/><path d="M421.7 446.6c-18 0-32.7 14.7-32.7 32.7s14.7 32.7 32.7 32.7 32.7-14.7 32.7-32.7-14.7-32.7-32.7-32.7" style="fill:#05ac3f"/><path d="M421.7 178.5c-18 0-32.7 14.7-32.7 32.7s14.7 32.7 32.7 32.7 32.7-14.7 32.7-32.7c-.4-18-14.7-32.7-32.7-32.7" style="fill:#ef1541"/><path d="M421.7 89.3c-18 0-32.7 14.7-32.7 32.7s14.7 32.7 32.7 32.7 32.7-14.7 32.7-32.7c-.4-18.1-14.7-32.7-32.7-32.7" style="fill:#ff7112"/><path d="M421.7 0c-18 0-32.7 14.7-32.7 32.7s14.7 32.7 32.7 32.7 32.7-14.7 32.7-32.7C454 14.7 439.7 0 421.7 0" style="fill:#fccc12"/><path d="M192.9 20.2C114.4 20.2 50.6 84 50.6 162.5v329.2h67.5V309l24.8 26.2 99.2-39c56.5-22 93.2-73 93.2-133.6-.1-78.5-63.9-142.4-142.4-142.4m25.3 216.3-100.1 39V162.6c0-45.5 34-78 74.8-78s74.8 33 74.8 78c0 28.4-13.7 59.7-49.5 73.9"/></svg>' },
    "amazonprime": { name: "Amazon Prime", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M249.7 407.3c-22.2-.5-44.3-3.7-65.7-9.3-20.1-5.2-39.4-13-57.4-23.2-19.2-10.7-36.5-24.7-51-41.3-6.2-7.1-9.6-11.8-11.2-15.7-.6-1.2-.9-2.6-1-3.9-.1-2.5.7-4.1 2.6-5 .7-.4.8-.4 2.1-.4.7 0 1.4 0 2.1.3 2.3.7 5.1 2.5 8.8 5.5 12.8 10.4 26.7 19.3 41.4 26.7 16.4 8.3 32.5 14.3 52.7 19.6 22.8 6 46.2 9.6 69.8 10.9 8.1.5 10.4.5 21.1.5 11.8 0 17.1-.2 26.9-.8 40.2-2.8 79.9-12.1 109.5-25.8 2.4-1.1 4.7-2.3 7-3.4 5-2.5 6.3-3.1 8.4-3.9 2.9-1 4.9-.7 6.6 1.1 1.1 1.1 1.7 2.7 1.6 4.3-.6 4.6-6.6 11.2-18.2 19.9-27.7 20.9-66.1 35.5-108.4 41.3-9.7 1.3-19.5 2.2-29.3 2.5-6.2.2-12.3.2-18.4.1m179.5-26.6q-1.95-.75-3-2.7c-.9-1.9-.6-3.5 1.2-7.1 1.1-2.2 2.2-4.3 3.5-6.3 4.6-7.6 9.2-17.7 11.3-25 2.2-7.3 2.4-11.4.9-13.8-1.3-2-5.6-3.3-12.6-3.7-2.7-.2-11.5-.1-14.1.2-5.8.5-9.9 1.1-15.3 2.2-3.9.8-4.6.9-7.4.9-2.7 0-3.2-.1-4.3-.6-1.7-.9-2.6-2.7-2.3-4.6.3-1.5 1.3-3 3.1-4.5 4.7-3.9 11.9-7.7 19.9-10.3 8.3-2.8 17.1-4 25.8-3.7 5 .2 10 .9 14.8 2.2 7.9 2 12.7 4.7 14.4 7.9 1.3 2.5 1.8 5 1.7 9.3-.1 7.4-1.3 14.7-3.7 21.7-3.4 10.5-9.4 20-17.4 27.7-5.9 5.8-10 8.9-13.3 10-1 .3-2.1.4-3.2.2m-426.7-81c-.9-.4-1.7-1.1-2.2-2l-.3-.5v-73c0-66.1 0-73 .1-73.6.2-.8 1.1-1.8 2-2.2l.6-.3h20.1l.5.2c.8.4 1.5 1.1 1.9 1.9.4.9.5 1.4 2.1 9.4l1.1 5.6h1.1l.5-1.1c1.2-2.5 2.6-4.9 4.3-7 2.1-2.5 4.6-4.7 7.3-6.6 7.1-4.8 15.9-6.4 24.3-4.5 8.5 1.9 16.1 7.5 21.7 16 5.4 8.2 9.1 20 10.3 32.3.4 3.7.4 4.7.5 10 .2 5.2-.1 10.4-.7 15.6-1.8 14.2-6.6 26.5-13.6 34.6-1.6 1.8-3.3 3.4-5.1 5-4.4 3.5-9.7 5.8-15.2 6.7-2.2.3-7.4.4-9.5.1-8.1-1.2-14.2-5-19.5-12.1-1.5-2-2.8-4.1-4-6.3-.3-.5-.3-.5-.9-.5h-.6v49.8l-.3.6c-.5.8-1.2 1.5-2 1.8-.5.2-1.8.2-12.3.2-9.6 0-11.9 0-12.2-.1m49.3-58.2c4.2-.8 7.6-3.2 10.2-7.3 3.3-5.1 5.3-12.6 5.9-22.4.2-2.9.1-11.7-.2-14.2-.5-5.3-1.3-9.7-2.6-13.2-2.8-8.2-7.2-12.8-13.4-14-2.1-.3-4.3-.3-6.4 0-5.1 1-9 4.3-11.8 9.9-1.6 3.3-2.8 6.8-3.4 10.4-1.4 7.2-1.7 18.2-.6 26.6.9 7.1 2.8 12.9 5.6 17.1 3 4.4 6.7 6.8 11.6 7.3 1.3.1 3.8 0 5.1-.2m408.8 24.9-1.7-.2c-8.3-.7-16.3-3.8-23-8.7-3.2-2.5-6.2-5.3-8.7-8.4-7.1-9-11.5-20.4-12.8-33.3-.3-3.4-.4-5.6-.4-10.3 0-4.5.4-9 1.1-13.4 4.1-23.6 19.1-41.3 38.7-45.6 3.6-.8 6.4-1.1 10.5-1.1 5.5-.1 10.9.9 16.1 2.9 2 .8 3.9 1.7 5.7 2.8 6 3.6 11.1 8.4 15 14.2 4.7 7.1 7.9 15.1 9.5 23.4 1.1 5.7 1.6 10.8 1.5 18.6 0 4.7 0 4.8-.3 5.3-.5 1-1.4 1.7-2.5 1.9-.5.1-6.4.2-32.6.2h-32l.1.8c.9 9.6 2.6 15.8 5.7 20.5 2.6 3.9 5.8 6.1 10 7 1.4.3 4.6.4 6.2.2 4.4-.5 7.6-2 10.3-4.8 2.2-2.3 3.6-5.1 4.7-9 .5-2 .7-2.3 1.2-2.9.6-.6 1.2-.9 2.1-.9 1 0 22 4.7 22.9 5.1 1.1.5 1.7 1.6 1.6 2.8-.2 1.7-2.8 7.6-4.7 11.1-4.2 7.4-10.4 13.3-18 17.1-5.2 2.5-10.8 4.1-16.5 4.6-1.6.1-8.5.2-9.7.1m21.3-72.1c-.1-1.6-.6-4.7-1-6.6-1.8-8.8-5.4-14.9-10.3-17.5-4.1-2-8.9-2.1-13.1 0-1.6.8-3 1.9-4.2 3.1q-2.25 2.1-3.6 4.8c-2.1 3.8-3.7 8.9-4.6 14.9-.1.8-.2 1.6-.2 1.8v.3h37zM117 263.4c-.9-.4-1.6-1.2-2-2.1-.2-.5-.2-5.3-.2-55.5 0-49.7 0-55 .2-55.5.3-.8.9-1.5 1.7-1.8l.7-.3h9.7c10.1 0 10.6 0 11.5.4.6.3 1.4 1.2 1.6 2 .1.4.9 3.7 1.6 7.5l1.4 7.1c.1.2.1.3.6.2h.6l.6-1.3c1.2-2.8 2.8-5.5 4.7-7.9 1.1-1.3 3.3-3.6 4.7-4.6 5.2-4 10.7-5.8 17.6-5.8 4.7 0 8.8.8 12.6 2.4 1.2.5 1.9 1.1 2.3 1.8.3.5.3.7.3 1.8 0 1.2 0 1.3-2.8 12.3-1.5 6.1-2.8 11.3-2.9 11.6-.2.6-.8 1.2-1.4 1.4-.4.1-.8.2-1.2.2-.9 0-1 0-4.9-1.6-4-1.6-7-2.6-9.4-2.9-2-.2-4.1-.2-6.1 0-2 .3-4 1-5.7 2.1-1.3.8-3.4 2.9-4.4 4.4-2.7 4.1-3.9 8.8-4.2 16.2-.1 1.5-.1 16.9-.1 34.1 0 34.8.1 31.8-.7 32.9-.3.4-.6.6-1 .8l-.7.3h-24.2zm82.8.1c-1.1-.3-1.8-1-2.1-2-.2-.5-.2-3.1-.2-55.7v-55.1l.3-.6c.4-.8.9-1.3 1.7-1.7l.6-.3h11.7c12.2 0 12.7 0 13.6.4.6.3 1 .8 1.3 1.4.2.4.2 3.3.2 55.7 0 50.4 0 55.3-.1 55.9-.1.5-.4.9-.8 1.2-1.1 1.1-.1 1-13.7 1-9.4 0-12.2 0-12.5-.2m50 0c-.9-.3-1.7-1.1-2.2-2l-.3-.5V150.6l.3-.6c.3-.7.9-1.3 1.7-1.6l.6-.3H260c9.4 0 10.2 0 10.6.2 1 .4 1.8 1.2 2.1 2.2.2.5 1.2 5.1 3 14.2l.1.6h1.2l.4-1c.8-1.9 1.7-3.7 2.8-5.5 4.5-7.2 11-11.7 18.9-13 5.2-.9 11.1-.5 15.9 1.2 6.3 2.2 11.5 6.4 15.4 12.6 1 1.6 1.8 3.3 2.6 5l.3.7h1.1l.9-1.4c4-6.1 8.9-11.2 13.8-14.1 6.5-3.8 14.1-5.3 21.6-4.1 7.6 1.1 14.5 5.2 19 11.4 1.3 1.8 2.4 3.5 3.5 5.8 2.9 5.8 4.7 12.5 5.4 20.2.4 4 .4 7.1.4 42.7V261l-.3.6c-.3.7-.8 1.3-1.6 1.7l-.6.3h-24.3l-.5-.3c-.7-.4-1.3-1-1.7-1.7l-.3-.6-.1-35.6c-.1-37.8 0-36-.6-39-1.1-6.4-3.9-10.8-8.2-12.9-2.1-1-4.2-1.4-7.1-1.3-4.1.1-7.2 1.4-9.8 4-3.1 3.1-4.9 7.7-5.8 14.7-.2 1.4-.2 4.7-.2 35.7l-.1 34.2-.3.6c-.3.7-.8 1.3-1.6 1.7l-.6.3H311l-.6-.3c-.7-.4-1.3-1-1.7-1.7l-.3-.5-.1-35.6c-.1-37.8 0-36-.6-39-1.1-6.4-3.9-10.8-8.2-12.9-2.1-1-4.2-1.4-7.1-1.3-4.1.1-7.2 1.4-9.8 4-3.1 3.1-4.9 7.7-5.8 14.7-.2 1.4-.2 4.7-.2 35.7l-.1 34.2-.3.6c-.3.7-.8 1.3-1.6 1.7l-.6.3h-12c-9.4.4-11.9.4-12.2.2M209.9 139c-4-.5-7.7-2.3-10.4-5.2-2.1-2.2-3.6-5-4.1-8-.3-1.7-.4-4.9-.2-6.8.7-5 2.9-8.8 6.9-11.4 5.7-3.8 14.1-3.9 19.8-.3 2.2 1.4 4 3.3 5.4 5.5 2.4 4 2.9 10.3 1.2 15.3-1.6 4.5-5.1 8.1-9.5 9.8-2.7 1-6.1 1.4-9.1 1.1" style="fill:#0779ff"/></svg>' },
    "amazonprimevideo": { name: "Amazon Prime Video", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M225.3 511.7c-47.4-3.8-84.6-13.6-121.1-32.1-24.9-12.6-40.9-23.9-58.1-41.3-13.4-13.5-20.2-22.4-21.5-28.6-1.1-5 .9-8.1 5.4-8.1 2.9 0 7.7 2.7 15.8 9.1 35.4 27.6 84.9 47.6 139.8 56.5 51.2 8.3 103.2 7.3 156-3.1 17.2-3.4 32.5-7.4 48.1-12.6 11.8-3.9 19.4-7.1 31.4-13 7.9-3.9 10.4-4.8 13-5 3-.2 3.3-.2 4.9 1.6 2.5 2.7 2.4 6.2-.3 10.3-2.5 3.7-6.9 8.2-13.4 13.4-33.5 27-87.9 46.3-146.3 52-10.5 1.1-44.5 1.6-53.7.9m219-31.9c-3.3-2.9-2.8-6.1 2.7-15.1 7.3-12 13.4-26.6 14.9-35.5 1.3-7.5-.6-9.9-8.9-11.3-7.8-1.4-25.8-.4-37.2 2-2.1.4-5.9.8-8.4.8-4.1 0-4.7-.1-5.9-1.3-.7-.7-1.4-2.3-1.6-3.5-.3-1.9-.1-2.5 1.5-4.3 2.5-2.9 7.4-6.1 14.1-9.3 11.6-5.5 21.8-7.8 34.9-7.8 16.9 0 30.4 4.1 34.9 10.5 1.7 2.4 1.7 2.6 1.9 10.3.1 5.8 0 9.3-.7 12.9-2.2 12-8.4 25.7-15.5 34.6-4.6 5.7-14.9 15.2-18.6 17-4.1 2.1-5.8 2.1-8.1 0m-237.9-124c-14-2.7-25.8-16.8-30.5-36.5-3.2-13.5-3.4-32.9-.5-46.5 3.9-18 12.6-31 24.4-36.5 15-7 30.6-2.7 39.9 11.1 1.5 2.3 3 4 3.3 3.8s.5-10.2.5-25.4c0-24.6 0-25.1 1.1-26.2s1.7-1.1 14.2-1c9.5.1 13.3.4 13.8.9 1.3 1.3 1.5 12.7 1.2 82.5l-.2 69.2-1.2 1.3c-1.1 1.2-1.5 1.3-11.6 1.3-5.8 0-10.9-.2-11.4-.3-1.5-.6-2.4-3-3.7-10.1-.7-3.8-1.4-6.8-1.6-6.8s-1.1 1.4-2 3.2c-2.4 4.8-9.1 11.1-14.3 13.7-2.3 1.1-5.6 2.3-7.2 2.6-3.6.5-10.4.4-14.2-.3m24.5-26.4c9.1-4.4 13.9-19 12.9-38.8-.9-18-6.2-28.4-15.7-31-3.1-.8-4.1-.9-6.7-.3-9 2-14.1 10.2-15.9 25.7-1.1 9.6-.5 20.9 1.7 28.9 2.2 8.1 5.9 13.3 11.1 15.7 3.2 1.5 9.2 1.4 12.6-.2m99.7 26.3c-5.5-1.2-9.4-2.6-14.1-5.3-13.4-7.7-22.9-22.6-25.9-40.6-1.2-7.4-1.2-21.1 0-28.4 2.8-17.3 12.3-32.9 24.9-41 6.6-4.3 17.1-7.3 25.2-7.3 4.7 0 12.4 1.5 17 3.3 11.1 4.3 20.9 14.6 26.5 27.8 3.7 8.8 5.3 17.1 5.4 28.8.1 7.9 0 8.8-1 9.9-1.1 1.2-1.2 1.2-33.9 1.2h-32.9v1.9c0 3.4 1.6 10.2 3.3 14.4 2.1 5.1 4.8 8.4 8.6 10.3 3.9 2 10.4 2.1 14.7.2 3.5-1.5 7.5-5.7 8.7-9.1.5-1.3 1.2-3.4 1.6-4.6.7-2 1-2.3 2.8-2.4 2.5-.2 22.6 4.2 24.4 5.3 1.8 1.2 1.4 3.7-1.7 10.3s-8.2 13-13.4 16.9c-8.7 6.5-15.8 8.8-28.1 9.1-5.8 0-9.7-.2-12.1-.7m27.2-72.3c.6-.4.6-1.4-.2-5.4-1.8-9.8-5.7-16.5-11.1-19-8.3-3.9-17.6 1.1-21.6 11.5-1.9 4.8-3.3 12.1-2.6 12.8.8.7 34.4.8 35.5.1m84 72.2c-13.9-3.2-26.5-13.7-33.9-28.1-2.4-4.8-5.3-14.4-6.2-20.4-3.4-23.8 3.4-46.7 17.7-60.4 7.5-7.1 14.2-10.8 23.2-12.6 31.5-6.3 58.6 19.4 60.3 57.3.7 15.8-3.1 30.9-10.8 42.5-6.4 9.7-16.5 17.4-27.3 20.8-5 1.7-17.6 2.1-23 .9m16.9-25.2c5.1-2.6 9-8.8 11.1-17.6 1-4.4 1.2-6.8 1.2-17.7 0-10.1-.2-13.4-1-16.7-2.9-12.2-7.7-18.5-15.2-20.1-9.9-2-17.7 5.3-20.6 19.3-3.5 17-1.4 37.9 4.7 47.2 1.7 2.6 5.7 5.8 8.3 6.7 2.5.7 9 .1 11.5-1.1M40 352.6c-1.1-1.2-1.6-2.8-5.1-15.4-1.8-6.7-3.7-13.4-5.6-20.1-2.8-10-5.6-20.1-8.4-30.1-3.5-12.8-7.1-25.5-10.7-38.3-1.4-4.8-2.5-9.2-2.5-9.9 0-2.6 1.5-2.9 15.7-2.9 11.9 0 13.3.1 14.4 1 1 .8 1.9 4.1 5.6 20.8 4.4 20 5.9 26.5 7.8 35.2 2.9 12.6 6.1 28 6.1 28.9 0 1.7.9 0 1.6-3.2s2.2-9.9 9.2-41.9c7.4-33.7 8.6-38.6 9.5-39.6.8-.8 2.8-.9 14.2-1.1 14.2-.2 15.9.1 16.2 2.5.2 1.1-1.8 8.3-10.3 38.5-4 14.5-8.1 29.1-12 43.7-1.9 7.1-3.4 12.3-7.8 27.5-.6 2.1-1.5 4.1-1.9 4.6-.7.7-3.3.9-18 .9-16 0-17.1-.1-18-1.1m87.1-.1-1.5-1.2.1-56.6c.1-53.5.2-56.7 1.1-57.6s2.4-1 13.5-1.2c10.5-.1 12.8 0 14.2.7l1.7.9v56.3c0 40.5-.2 56.7-.6 57.7-.3.8-1.2 1.5-1.8 1.7-.7.2-6.6.3-13.3.3-11.2.2-12 .1-13.4-1m8.8-125.5c-5-1.3-9.9-5.9-11.6-10.8-1.1-3.4-1.2-8.8-.1-12.5 1-3.4 4.9-8 8.3-9.8 3.5-1.8 12.1-2.1 15.7-.5 4.2 1.8 6.8 4.3 8.7 8 1.5 3.1 1.7 3.9 1.7 8.5 0 5.9-1.1 8.8-4.3 12.2-3.3 3.4-6.8 4.9-12.1 5.2-2.5.1-5.3-.1-6.3-.3M3.1 198.1c-.8-.2-1.5-.6-2.1-1.1-.9-.8-1-5.1-1-75.7C0 80 .2 46 .5 45.7c1.1-1.6 3.1-1.9 12.9-1.9 5.5 0 10.4.2 10.9.3 1.4.5 1.9 1.9 3.4 9.3.8 3.8 1.6 7 1.8 7.2s1.2-1 2.1-2.8c1.9-3.8 7.8-9.9 11.7-12.1 6.7-3.9 14.2-5.4 21.4-4.2 16.9 2.6 28.7 17.1 34 41.7 1.3 6.1 1.6 26.9.6 34.9-1.9 14.1-7.3 27.2-14.3 34.8-7.2 7.7-13.6 10.9-22.9 11.4-6.6.4-10.9-.4-15.9-2.9-4.5-2.2-9.7-7.1-12.9-12.1-1.2-1.8-2.3-3.3-2.5-3.3s-.4 10.9-.4 24.2c0 13.6-.2 24.8-.5 25.6-.8 2.2-3.2 2.6-14.8 2.6-6.1 0-11.4-.2-12-.3m51.4-60.3c4.1-1.4 8-5.5 10.1-10.8 2.5-5.9 3.6-11.9 3.9-21.2.6-16.2-3.1-30.1-9.4-35.4-2-1.7-7.2-3.7-9.6-3.7-12.1 0-19.9 13.9-19.9 35.4 0 15.3 3.1 26.3 8.9 32.2 4.3 4.1 10.2 5.5 16 3.5m399.8 26.1c-19.3-3.5-34.4-18.5-39.7-39.4-7.1-28.3.7-58 19.1-72.9 17.4-14 42.4-14 58.4.1 7 6.1 11 12 14.9 21.4 3.2 7.8 4.5 14.5 4.9 25.3.2 5 .1 9.7 0 10.4-.8 3.3.9 3.2-34.7 3.2-17.9 0-32.7.2-32.9.5-.6 1 1.4 10.9 3.1 15.3 2.2 5.8 6.4 10.3 10.8 11.6 9.5 2.7 18.4-1.5 21.4-10.2 2.1-5.9 2.4-6.3 4.7-6.5 1.7-.1 14.5 2.4 22.3 4.4 3.2.8 3.5 2.4 1.5 7.6-2.4 6.1-5.3 10.9-9.4 15.3-9.1 9.7-18.9 13.8-33.8 14.2-4.4.1-9.1-.1-10.6-.3m26.4-73.8c0-5.6-3.6-16-6.9-19.9-2.3-2.7-6.7-4.7-10.4-4.6-5.9 0-10.4 2.8-13.7 8.4-2.1 3.7-4.5 10.7-5.1 15l-.4 2.8h36.4zM116 160.5l-1.5-1.2v-56.8c0-52.1.1-56.9.9-57.6 1.2-1 20.8-1.4 23.1-.5 1.9.8 2.5 2.1 3.9 9.8.6 3.4 1.3 6.3 1.5 6.5s1.3-1.3 2.3-3.3c2.4-4.6 8.1-10.6 12-12.6 6.5-3.3 16-4.2 23.3-2.1 4.6 1.3 6.5 2.9 6.5 5.5 0 1.9-3.7 17.5-5.4 22.6-1.3 3.9-2.1 4.1-7.6 2-6.5-2.4-9.8-3.3-12.9-3.3-8.4 0-13.7 4.4-16.4 13.7-.9 2.9-1 7.4-1.3 40-.2 29-.5 36.8-1 37.4-.5.5-3.9.8-13.4.9-12 .2-12.6.1-14-1m82.5.6c-.6-.3-1.3-.9-1.5-1.3-.2-.6-.6-102.4-.4-112.7.1-2.9 1.8-3.2 15.8-3.2 13.8 0 14.1.1 14.4 3.6.1.9.1 26.5.1 56.8-.1 54.3-.1 55.2-1.2 56.3s-1.8 1.1-13.5 1.1c-7-.1-13.1-.4-13.7-.6m49-.1c-.7-.3-1.5-1.2-1.8-2-.3-.9-.5-21.9-.5-57.1 0-47.2.1-55.9.8-56.8.7-1 1.7-1.1 11.5-1.3 7.2-.1 11.2 0 12.2.5 1.7.7 1.9 1.3 3.9 11.3.5 2.7 1.1 5 1.3 5.2s1.2-1.4 2.3-3.5c3.5-7 9.3-12.2 16.3-14.7 2.6-1 4.6-1.2 9.7-1.3 6.8-.1 9.6.6 15.3 3.5 3.8 1.9 9.7 7.9 12.2 12.5 1.2 2.1 2.3 3.8 2.5 3.8s1.2-1.2 2.2-2.7c5.2-7.6 12.7-13.6 19.9-15.9 5.7-1.8 14.7-1.8 20 .1 11.4 3.9 18.2 12.4 22.4 28.2 1.2 4.4 1.2 5.7 1.4 46.4.2 36.1.1 42-.6 43-.8 1.1-1.6 1.1-13.6 1.3-12.2.2-12.8.1-14.3-1l-1.5-1.2-.2-37.8c-.2-37.3-.2-37.9-1.4-41.5-2.5-7.5-6.6-10.7-13.5-10.8-7-.1-12 3.7-14.6 11.1-1.9 5.3-2.2 12-2.2 45.9 0 32.3 0 33.1-1.1 34.2-1 1-1.9 1.1-13.4 1.1-12.6 0-14-.2-15-2.2-.4-.7-.6-12.7-.6-36.1 0-35.1-.2-39.3-2-45-2.6-8.1-12.5-11.5-20.4-7.2-5.1 2.8-7.8 8.5-8.8 18.6-.3 2.9-.5 19.8-.5 37.5v32.2l-1.2 1.1c-1.2 1.1-1.9 1.1-13.3 1.1-6.7.1-12.7-.2-13.4-.5M206.6 34.9c-4.9-1.5-9.2-5.3-11.3-9.8-1.8-3.9-1.8-11.1 0-15.1 1.6-3.6 5.1-7.1 8.7-8.7 4-1.8 11.1-1.7 15.2.1 4 1.7 8 6.2 9.3 10.4 1.3 4.3.9 10.2-1 14.4-1.7 3.7-5.9 7.2-10 8.4-2.9.9-8.5 1-10.9.3" style="fill:#0779ff"/></svg>' },
    "appletv": { name: "Apple TV", bg: "#000000", ink: "#ffffff", kind: "", path: "M20.57 17.735h-1.815l-3.34-9.203h1.633l2.02 5.987c.075.231.273.9.586 2.012l.297-.997.33-1.006 2.094-6.004H24zm-5.344-.066a5.76 5.76 0 0 1-1.55.207c-1.23 0-1.84-.693-1.84-2.087V9.646h-1.063V8.532h1.121V7.081l1.476-.602v2.062h1.707v1.113H13.38v5.805c0 .446.074.75.214.932.14.182.396.264.75.264.207 0 .495-.041.883-.115zm-7.29-5.343c.017 1.764 1.55 2.358 1.567 2.366-.017.042-.248.842-.808 1.658-.487.71-.99 1.418-1.79 1.435-.783.016-1.03-.462-1.93-.462-.89 0-1.17.445-1.913.478-.758.025-1.344-.775-1.838-1.484-.998-1.451-1.765-4.098-.734-5.88.51-.89 1.426-1.451 2.416-1.46.75-.016 1.468.512 1.93.512.461 0 1.327-.627 2.234-.536.38.016 1.452.157 2.136 1.154-.058.033-1.278.743-1.27 2.219M6.468 7.988c.404-.495.685-1.18.61-1.864-.585.025-1.294.388-1.723.883-.38.437-.71 1.138-.619 1.806.652.05 1.328-.338 1.732-.825Z" },
    "applemusic": { name: "Apple Music", bg: "#FA243C", ink: "#ffffff", kind: "", path: "M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 011.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 00.02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 00-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066-.76.15-1.52.303-2.28.456l-2.325.47-1.374.278c-.016.003-.032.01-.048.013-.277.077-.377.203-.39.49-.002.042 0 .086 0 .13-.002 2.602 0 5.204-.003 7.805 0 .42-.047.836-.215 1.227-.278.64-.77 1.04-1.434 1.233-.35.1-.71.16-1.075.172-.96.036-1.755-.6-1.92-1.544-.14-.812.23-1.685 1.154-2.075.357-.15.73-.232 1.108-.31.287-.06.575-.116.86-.177.383-.083.583-.323.6-.714v-.15c0-2.96 0-5.922.002-8.882 0-.123.013-.25.042-.37.07-.285.273-.448.546-.518.255-.066.515-.112.774-.165.733-.15 1.466-.296 2.2-.444l2.27-.46c.67-.134 1.34-.27 2.01-.403.22-.043.442-.088.663-.106.31-.025.523.17.554.482.008.073.012.148.012.223.002 1.91.002 3.822 0 5.732z" },
    "icloud": { name: "iCloud", bg: "#3693F3", ink: "#ffffff", kind: "", path: "M13.762 4.29a6.51 6.51 0 0 0-5.669 3.332 3.571 3.571 0 0 0-1.558-.36 3.571 3.571 0 0 0-3.516 3A4.918 4.918 0 0 0 0 14.796a4.918 4.918 0 0 0 4.92 4.914 4.93 4.93 0 0 0 .617-.045h14.42c2.305-.272 4.041-2.258 4.043-4.589v-.009a4.594 4.594 0 0 0-3.727-4.508 6.51 6.51 0 0 0-6.511-6.27z" },
    "googleone": { name: "Google One", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M383.1 401.4v53.7c0 31.4-25.4 56.9-56.7 56.9s-56.7-25.5-56.7-56.9V314.5z" style="fill:#34a853"/><linearGradient id="google-one_svg__a" x1="368.522" x2="368.522" y1="102.911" y2="450.228" gradientTransform="matrix(1 0 0 -1 -42.14 506.99)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#1a73e8"/><stop offset="1" style="stop-color:#4285f4"/></linearGradient><path d="M383.1 56.9v344.5l-113.4-86.9v-137l92.8-76.7c13.6-11.3 20.6-27.5 20.6-43.9" style="fill:url(#google-one_svg__a)"/><path d="M383.1 54.9v1.9c0 16.4-7 32.6-20.6 43.9l-92.8 76.7V56.9c0-18.6 8.9-35.2 22.8-45.6 1-.8 2-1.5 3.1-2.1l1.5-.9c.9-.6 1.9-1.1 2.7-1.6l2.5-1.3 2.1-1c.8-.3 1.7-.7 2.6-1 .8-.3 1.7-.6 2.6-.9 1.6-.5 3.3-1 5-1.3.5-.1 1-.2 1.6-.3.4-.1.8-.1 1.1-.2.7-.1 1.3-.2 2-.3l2.4-.3c.6-.1 1.3-.1 1.9-.1.9 0 1.9-.1 2.9-.1 2.1 0 4.1.1 6.1.3 1 .1 2 .3 3.1.4q1.5.15 3 .6c1 .2 2 .5 3 .8.8.2 1.7.5 2.5.8 1.6.5 3.2 1.1 4.7 1.8.8.3 1.5.7 2.3 1 1 .5 1.9 1 2.9 1.5 1.4.8 2.7 1.6 4.1 2.5.1.1.3.2.4.3 1.4 1 2.8 2.1 4.2 3.2.7.6 1.3 1.1 2 1.7l.1.1c.6.6 1.3 1.2 1.9 1.9l1.9 1.9c1.3 1.3 2.4 2.8 3.5 4.2.8 1 1.5 2 2.1 3.1l.9 1.5c.6.9 1.1 1.9 1.6 2.7.3.7.9 1.8 1.3 2.5l.9 2.1c.3.8.7 1.7 1 2.6.3.8.6 1.7.9 2.6.4 1.3.7 2.5 1 3.7.2.6.3 1.1.4 1.7.2.8.3 1.6.5 2.4.1.6.2 1.3.3 1.9l.3 2.4c.1.6.1 1.3.1 1.9-.5.3-.4.6-.4.9" style="fill:#ea4335"/><path d="M290.3 13c.7-.6 1.4-1.1 2.2-1.7-13.8 10.4-22.7 26.9-22.7 45.6v120.6l-48.2 39.9c-10.5 8.8-23.3 13-36 13-16.3 0-32.5-7-43.7-20.7-19.9-24.3-16.4-60.1 7.7-80.1z" style="fill:#fbbc04"/></svg>' },
    "microsoft365": { name: "Microsoft 365", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><radialGradient id="microsoft-365_svg__a" cx="-90.407" cy="-6.401" r="11.637" gradientTransform="matrix(-11.7002 31.247 -54.5012 -20.4075 -1227.181 2794.834)" gradientUnits="userSpaceOnUse"><stop offset=".064" style="stop-color:#ae7fe2"/><stop offset="1" style="stop-color:#0078d4"/></radialGradient><path d="m210.4 11.9-2.6 1.6q-6.3 3.75-11.7 8.4l7.5-5.3h64l11.6 88.1-58.2 58.2-58.2 40.4V250c0 32.6 17 62.8 44.9 79.6l61.3 37.1-129.4 75.5h-25L68.2 414c-27.9-16.9-44.9-47.1-44.9-79.6V177.6c0-32.6 17-62.8 44.9-79.7l139.6-84.5c.9-.5 1.8-1 2.6-1.5" style="fill:url(#microsoft-365_svg__a)"/><linearGradient id="microsoft-365_svg__b" x1="253.639" x2="198.241" y1="653.085" y2="557.27" gradientTransform="translate(0 -278)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#114a8b"/><stop offset="1" style="stop-color:#0078d4;stop-opacity:0"/></linearGradient><path d="m210.4 11.9-2.6 1.6q-6.3 3.75-11.7 8.4l7.5-5.3h64l11.6 88.1-58.2 58.2-58.2 40.4V250c0 32.6 17 62.8 44.9 79.6l61.3 37.1-129.4 75.5h-25L68.2 414c-27.9-16.9-44.9-47.1-44.9-79.6V177.6c0-32.6 17-62.8 44.9-79.7l139.6-84.5c.9-.5 1.8-1 2.6-1.5" style="fill:url(#microsoft-365_svg__b)"/><radialGradient id="microsoft-365_svg__c" cx="-95.09" cy="32.254" r="11.637" gradientTransform="matrix(30.7198 -4.5183 2.9847 20.2925 2922.94 -684.456)" gradientUnits="userSpaceOnUse"><stop offset=".134" style="stop-color:#d59dff"/><stop offset="1" style="stop-color:#5e438f"/></radialGradient><path d="M349.1 197.8v52.1c0 32.6-17 62.8-44.9 79.6L164.6 414c-28.6 17.4-64.1 18-93.2 2l136.4 82.6c29.6 17.9 66.8 17.9 96.4 0L443.8 414c27.9-16.9 44.9-47.1 44.9-79.6v-37.7l-11.6-17.5z" style="fill:url(#microsoft-365_svg__c)"/><linearGradient id="microsoft-365_svg__d" x1="389.732" x2="330.368" y1="510.531" y2="595.653" gradientTransform="translate(0 -278)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#493474"/><stop offset="1" style="stop-color:#8c66ba;stop-opacity:0"/></linearGradient><path d="M349.1 197.8v52.1c0 32.6-17 62.8-44.9 79.6L164.6 414c-28.6 17.4-64.1 18-93.2 2l136.4 82.6c29.6 17.9 66.8 17.9 96.4 0L443.8 414c27.9-16.9 44.9-47.1 44.9-79.6v-37.7l-11.6-17.5z" style="fill:url(#microsoft-365_svg__d)"/><radialGradient id="microsoft-365_svg__e" cx="-123.182" cy="-9.402" r="11.637" gradientTransform="matrix(-24.1583 -6.1256 10.3118 -40.6682 -2424.463 -851.827)" gradientUnits="userSpaceOnUse"><stop offset=".058" style="stop-color:#50e6ff"/><stop offset="1" style="stop-color:#436dcd"/></radialGradient><path d="M443.8 97.9 304.2 13.4C275.5-4 239.8-4.5 210.6 11.8l-2.8 1.7a93.13 93.13 0 0 0-44.9 79.7v110.4l44.9-27.2c29.6-17.9 66.7-17.9 96.4 0l139.6 84.5c27 16.3 43.8 45.2 44.9 76.6 0-1 .1-2 .1-3.1V177.6c-.1-32.6-17.1-62.8-45-79.7" style="fill:url(#microsoft-365_svg__e)"/><linearGradient id="microsoft-365_svg__f" x1="174.261" x2="261.665" y1="446.725" y2="446.725" gradientTransform="translate(0 -278)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#2d3f80"/><stop offset="1" style="stop-color:#436dcd;stop-opacity:0"/></linearGradient><path d="M443.8 97.9 304.2 13.4C275.5-4 239.8-4.5 210.6 11.8l-2.8 1.7a93.13 93.13 0 0 0-44.9 79.7v110.4l44.9-27.2c29.6-17.9 66.7-17.9 96.4 0l139.6 84.5c27 16.3 43.8 45.2 44.9 76.6 0-1 .1-2 .1-3.1V177.6c-.1-32.6-17.1-62.8-45-79.7" style="fill:url(#microsoft-365_svg__f)"/></svg>' },
    "tmobile": { name: "T-Mobile", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M368.6 337.9H471V235.5H368.6zM41 0v174.1h30.7V169c0-81.9 46.1-133.1 133.1-133.1h5.1v368.6c0 51.2-20.5 71.7-71.7 71.7h-15.4V512H389v-35.8h-15.4c-51.2 0-71.7-20.5-71.7-71.7V35.8h5.1c87 0 133.1 51.2 133.1 133.1v5.1H471V0zm102.4 337.9H41V235.5h102.4z" style="fill:#e20074"/></svg>' },
    "atandt": { name: "AT&T", bg: "#009FDB", ink: "#ffffff", kind: "", path: "M4.584 21.438a12.077 12.077 0 0 0 7.349 2.495 12 12 0 0 0 7.887-2.967c-.944.607-3.64 2.023-7.887 2.023-3.708 0-6.068-.81-7.349-1.55m8.158.606c2.966 0 6.202-.809 8.09-2.427.539-.405 1.01-1.011 1.483-1.753.27-.472.539-1.011.741-1.483-1.82 2.63-7.011 4.315-12.404 4.315-3.776 0-7.888-1.214-9.506-3.573 1.483 3.236 6 4.92 11.596 4.92m-3.236-5.257C3.37 16.787.472 13.955 0 12c0 .674.067 1.483.202 2.09.068.27.27.674.607 1.079 1.483 1.55 5.191 3.707 11.595 3.707 8.697 0 10.72-2.898 11.124-3.842.27-.674.472-1.888.472-2.967v-.674c-.607 2.292-8.022 5.394-14.494 5.394m-8.427-9.91C.742 7.55.337 8.763.202 9.37c-.067.27 0 .404.068.607.741 1.55 4.45 4.044 13.078 4.044 5.259 0 9.371-1.28 10.045-3.64.135-.404.135-.876 0-1.483-.202-.674-.472-1.483-.809-2.09.068 3.101-8.562 5.124-12.944 5.124-4.719 0-8.696-1.888-8.696-4.248.067-.337.135-.606.135-.809M19.82 3.034c.068.067.068.135.068.27 0 1.348-4.045 3.64-10.517 3.64-4.787 0-5.663-1.753-5.663-2.9 0-.404.135-.808.472-1.213-.607.607-1.146 1.147-1.686 1.82-.202.27-.337.54-.337.675 0 2.36 5.865 3.977 11.259 3.977 5.797 0 8.427-1.887 8.427-3.573 0-.606-.203-.943-.81-1.618a17.301 17.301 0 0 0-1.213-1.078m-1.753-1.281A11.794 11.794 0 0 0 11.933.067C9.64.067 7.55.674 5.73 1.82c-.539.27-.876.54-.876.877 0 1.01 2.36 2.09 6.54 2.09 4.112 0 7.348-1.214 7.348-2.36.067-.202-.203-.405-.675-.674" },
    "xfinity": { name: "Xfinity", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M410.7 0h-65.6c-26.2 0-44.6 9-59.7 29.1L214.8 124l-68.4-94.9C131.3 8.9 112.9 0 86.7 0H21.1l140.7 190.8L12.4 392.6l-4.3 5.9h62.5c26.2 0 44.6-9 59.7-29.1l84.5-111.8 162.3 225.2c14.1 19.9 33 29.2 59.7 29.2h67.1L268.5 190.9 410.8.1z"/></svg>' },
    "progressive": { name: "Progressive", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M308.2 327.9H194.7L116.5 496H0L224.1 16H440c49.4.2 95.9 38.6 58.2 121.7-21.4 47.2-40.3 87.9-49.8 107.5-29.5 60.9-67.5 83.2-140.2 82.7m67.4-233.2h-73.3L233.2 244h73.1c20.4 0 33.9-8.9 43.3-28.9 1.8-3.6 17.8-36.8 38.8-81.2 14.7-31.1 3.3-39.2-12.8-39.2" style="fill-rule:evenodd;clip-rule:evenodd;fill:#2d95e5"/></svg>' },
    "visiblebyverizon": { name: "Visible by Verizon", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M427.5 512h-343C37.8 512 0 474.2 0 427.5v-343C0 37.8 37.8 0 84.5 0h343C474.2 0 512 37.8 512 84.5v343c0 46.7-37.8 84.5-84.5 84.5" style="fill-rule:evenodd;clip-rule:evenodd;fill:#1700ff"/><path d="M177.9 162.8c0 14.4-11.7 26.1-26.1 26.1s-26.1-11.7-26.1-26.1 11.7-26.1 26.1-26.1 26.1 11.7 26.1 26.1m208.4 0c0 14.4-11.7 26.1-26.1 26.1s-26.1-11.7-26.1-26.1 11.7-26.1 26.1-26.1 26.1 11.7 26.1 26.1M256 375.3c-71.8 0-130.2-58.4-130.2-130.2H170c0 47.4 38.6 86 86 86s86-38.6 86-86h44.2c0 71.8-58.4 130.2-130.2 130.2" style="fill-rule:evenodd;clip-rule:evenodd;fill:#fff"/></svg>' },
    "mintmobile": { name: "Mint Mobile", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" id="mint-mobile_svg__Layer_1" x="0" y="0" version="1.1" viewBox="0 0 512 512"><style>.mint-mobile_svg__st10{fill:#fff}</style><path d="M261.2 330.8C244.1 334.5 140 320.2 123 324 65.4 329.9 1.1 380.5 1.6 380.8c0 0 37.8-39.1 119.1-17.3 54.3 19.7 129.7 81.3 129.7 81.3L359 359.3z" style="fill:#2b6744;fill-opacity:.76"/><path d="M248.2 414.8v26.4l34.6-26.4.2-.2z" style="fill:#1f1d1d"/><path d="M248.2 418.4v-3.7l-34.8-.7 34.8 27.1z" style="fill:#393636"/><path d="M247.3 140.8c-21-.2-41.1 2.1-60.5 6.7-20-23.9-43.1-43.8-69.4-59.8-2.5-1.4-4.8-2.7-7.2-4-6.3-3.6-12.8-7-19.4-10q-6.75-3-13.5-5.7c-.5 7.8-2.5 18-6 30.7 2.7 1.2 5.4 2.5 8.1 3.8 2.9 1.4 5.8 2.8 8.6 4.4 24.4 13.2 46.3 30.3 65.6 51.2-22.8 9.2-44.3 22.2-64.6 38.8-9.9 8.1-19 16.6-27.4 25.7-3.3-8-6.2-16.2-8.7-24.5-4-13.1-7-26.5-9.1-40 0-.1 0-.1-.1-.1 0-.4 0-.6.1-.6v-.1c-.1 0-.1-.1-.2-.1-1.8-.9-3.6-2.1-5.5-3.4-4-2.2-8-4.6-11.8-7.2-2.2-1.4-4.4-3-6.4-4.6-1.2-.8-2.5-1.6-3.9-2.5-1.6-1.4-3-2.7-4.5-4.2 1.9 40.8 11.4 78.9 28.4 114.3C21.2 276.3 8 306.4.1 340c11-2 23.2-3.2 36.5-3.8-11.9 7.2-21.6 17.2-29.1 29.9L0 383.4c21.4-18.8 45.8-29 73.4-30.7 17.7-1.1 35.4 1.1 52.2 6.6 23.3 11.5 47.5 26.1 72.7 43.9 5.1 3.5 10.1 7.1 15.1 10.9l34.7.7V404l1.3-263.2z" style="fill:#95d0ad"/><path d="M87.7 106.5c-2.8-1.6-5.7-3-8.6-4.4q-3.75-1.95-7.8-3.6c-2 7.2-4.5 15.2-7.4 23.9-.1.2-.1.3-.2.4-2.7 7.9-5.7 15.8-9 23.5l-3.7 9.9c-.4-.2-.9-.5-1.3-.7-.4 1.4-.9 2.8-1.3 4.1-1.5-.6-3.1-1.5-4.8-2.4l-.1-.1c-.1.1-.1.2-.1.6.1 0 .1 0 .1.1 2.1 13.5 5.2 26.9 9.1 40 2.6 8.5 5.5 16.8 8.9 24.9 8.4-9.1 17.6-17.7 27.5-25.8 20.3-16.6 41.9-29.6 64.7-38.8q-29.1-31.65-66-51.6" style="fill:#67ab84"/><path d="M7.4 121.7c0 2.3.4 4.3 1.3 6.1.4.6.8 1.1 1.3 1.5.3.4.6.8 1.2 1.3 0 .4-.1.7-.1 1.1.1 1.1.2 2.3.3 3.5 1.5 1.5 3 2.9 4.6 4.3 1.4.9 2.7 1.7 3.9 2.5 2 1.6 4.2 3.2 6.4 4.6 3.8 2.6 7.8 5 11.8 7.2 1.9 1.3 3.7 2.5 5.5 3.4 1.7.9 3.3 1.8 4.8 2.4 1.3-4.3 2.8-8.9 4.2-13.8 1.8-6.7 3.8-13.4 5.9-20.2l.9-2.1c2.7-8.9 5.4-17.7 8.2-26.6 1.2-4 2.6-8 4-12 .8-2.7 1.5-5.5 1.9-8.3.6-3 .9-6 .9-8.9-.7.2-1.3.5-1.9.9-1 .3-2.2.8-3.4 1.6-5.7 2.7-12.2 6.4-19.4 11.1-4.8 2.9-9.4 5.9-13.9 9.2-10 7.1-17.7 13.9-22.9 20.3-1.3 1.2-2.4 2.6-3.2 4.1l-1.9 4.9c-.2.7-.3 1.4-.4 1.9" style="fill:#538f6d"/><path d="M7.8 119.8c-.1.7-.3 1.3-.4 1.9-.1 3 .8 5.5 2.7 7.6 1.2 1.6 2.9 3.4 5.2 5.2 3.6 3.1 8.4 6.4 14.5 9.9 6.9 4.2 14 8.1 21.2 11.8l3.7-9.9c3.3-7.7 6.3-15.6 9-23.5.1-.1.1-.2.2-.4C72.2 98 76.6 79.7 77.3 67.6q.15-1.35-8.1 2.7C63.5 73 57 76.7 49.8 81.4 30.2 93.6 16.9 104.8 9.7 115c0-.1-1.9 4.8-1.9 4.8" style="fill:#b8dfc6"/><path d="M512 82c-74-3.8-140 18.3-198 66.1-.2.2-.4.4-.6.5-19.6-5.1-40.1-7.8-61.5-7.9l-2.4.1-.4 80.9c0 .1-.1.1-.1.2l-.2 39.7.1.1-.7 142.3v10.8l34.8-.2-.2.2c4.7-3.4 9.4-6.8 14.2-10q37.35-25.65 70.5-41.7c16.1-6.1 33-8.8 50.8-8.4 30.2.8 56.9 11.5 80 32q-2.1-7.5-7.5-17.1c-7.6-12.9-17.2-23-28.9-30.3 11.8.7 23.5 2 35 4.1-7.2-32.4-19.4-61.7-36.6-87.8 24.5-36 40.4-77.2 47.9-123.6 2.6-17.1 3.9-33.8 3.8-50" style="fill:#559b75"/><path d="M409.6 199.2c11.1 9.3 21.2 19.1 30.4 29.6 1.8-3 3.6-6 5.3-9 16.5-28.7 27.4-59.6 32.8-92.7l2-13.8q-73.05 5.1-132 47.4c21.7 9.5 42.2 22.3 61.5 38.5" style="fill:#377958"/><path d="M322.9 272.7c-5.5-.9-10.5.4-15 3.8-4.6 3.2-7.4 7.8-8.4 13.6-.7 4.2 0 8.4 1.7 12.2l37.6-1.3c.4-1.3.8-2.7 1-4.1.8-5.7-.3-10.8-3.5-15.5-3.3-4.8-7.8-7.7-13.4-8.7" style="fill:#211e1f"/><path d="M307.5 278.8c0-.9-.4-1.6-1.1-1.9-1.7 1.5-2.9 2.9-3.7 4.2l1.1.7c.9.2 1.8-.1 2.5-.7.8-.5 1.2-1.4 1.2-2.3" class="mint-mobile_svg__st10"/><path d="M177.3 274.2c-4.5-3.2-9.4-4.2-14.6-3.2-5.4.8-9.7 3.5-12.8 8.1-3.1 4.7-4.1 9.7-3.1 15 .3 1.9.9 3.6 1.6 5.2l35.9-1.5c1.3-3.4 1.6-6.9 1-10.6-.8-5.5-3.5-9.8-8-13" style="fill:#393537"/><path d="M154.7 276.6c0-.6-.2-1.2-.6-1.7-1.4.9-2.7 2.1-3.6 3.5.9.9 2.3 1 3.3.2l.2-.2c.4-.5.7-1.1.7-1.8" class="mint-mobile_svg__st10"/><path d="M165.6 219.4c-19.6 0-36.5 16.4-38.3 27.7 34.6-27.4 57-12.3 77.6 0 0-9.4-19.7-27.7-39.3-27.7" style="fill:#67ab83"/><path d="M321.9 219.5c-19.6 0-36.6 18.2-38.5 29.5 34.6-27.4 57.1-12.3 77.6 0 .1-9.4-19.4-29.5-39.1-29.5" style="fill:#377959"/><path d="m449.4 262.7.1-1.4c-26.3-2.5-52.9-6-79.4-7.2-23.1-1.1-45.8.3-68.4 5.4-15.3 4.1-28.9 12.2-45 12.4l-9.2-.6h-6.7c-7.2-.2-13-1.2-17.3-3.2-16.4-7.2-32.8-12.6-50.5-15.6-24-3.3-48.1-2.5-72.3-2.5-5.8 0-11.8.3-17.8.7L48.7 254l-.2 2.6.6 20.4c.2.4.4.7.8.9.2.1.3.1.5.2v.3c.2.4.4.7.8.9 2.3.9 4.4 2.3 6.2 4 .3.4.7.8 1 1.3 1.5 2.3 2.6 5.5 3.3 9.5 2.5 16.8 5.2 30.5 8.3 41.1 3.5 11.8 8.1 24.1 16.7 33 2.1 2.4 4.5 4.6 7.3 6.5 21.7 15 50.4 15.3 75.4 8.9 15.7-3.9 29.7-10.8 40-23.6 10.9-14 18.8-29 23.6-45l2.4-9.5c1.7-6.1 5.3-9.7 10.7-10.8l2.1-.3 5.2.7c2.3.6 4.2 1.6 5.8 3.1 1.4 1.8 2.5 4 3.2 6.7l2 9.6c2.8 13 9.3 26 16.3 37.2 3.1 4.9 6.4 9.2 10 13 9.6 10.7 21.3 17.8 36.3 22 24.3 6.8 54 9.2 75.7-6.3 12.6-9 19-22.7 23.9-37.2 3.5-10.8 6.8-24.4 9.7-41 .8-3.8 2-6.9 3.6-9.2 2.1-3 5-5.2 8.8-6.4.4-.4.7-.6.7-.8l1.4-23c-.5 0-.9-.1-1.4-.1M439 274l-.1 2.7-16-.3.1-2.7zm-17.6 25.3c.3 9-.9 18.2-2.6 27.2-3.3 18.2-13.6 39.1-30.7 47.7-23.1 11.5-58.3 6.5-79.4-7.3-2.6-1.7-5-3.6-7.2-5.8-6.7-7-11.8-15.8-15.2-24.6-5.5-13.7-6.8-28.6-3.9-43.1 4.5-21.6 30.7-26.4 49-26.8l39.3.7c13.8.3 28.8 2.4 40.2 11 1.1.8 2 1.6 3 2.4q6.9 7.5 7.5 18.6m-315.1 69.8c-3.1-1.8-6.1-4-8.9-6.7l-.3-.3c-1.1-1.2-2.2-2.4-3.2-3.7-8.2-10.7-13.5-23.4-15.4-36.8l-1.6-17c-.3-4.4-.3-7.8 0-10.3.9-9.6 5.2-16.9 12.8-22.1q8.55-5.85 20.1-7.8c6.1-1.1 12.8-1.7 20.3-1.6l39.3.7c11.7.7 21.5 2.9 29.6 6.4q6 2.7 9.9 6.3c.2.3.5.5.7.8 3.3 3.8 5.4 8.2 6.3 13.4 1.1 5.4 1.5 11.1 1.1 17-.6 9-2.7 17.7-6.3 26-3.7 9.1-9.2 17.3-16.2 24.3-4.7 4.8-10.6 8.5-17.8 11.2-8.9 3.1-17.5 5.1-25.7 6-6.2.9-12.5 1.1-18.8.7-10-.5-18.7-2.7-25.9-6.5M60 267.2l16 .3v2.6c-5.3-.2-10.7-.3-16.1-.3z" style="fill:#282527"/></svg>' },
    "googlefi": { name: "Google Fi", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><circle cx="67" cy="465.7" r="46.3" style="fill:#ea4335"/><path d="M298.7 153.6H74.4c-29.3 0-53.6 24.4-53.6 53.6s24.4 53.6 53.6 53.6h221.9c29.3 0 53.6-24.4 53.6-53.6 2.4-29.2-22-53.6-51.2-53.6" style="fill:#34a853"/><circle cx="74.4" cy="207.2" r="53.6" style="fill:#137333"/><path d="M176.8 295H71.9c-26.8 0-51.2 21.9-51.2 48.8 0 26.8 21.9 51.2 51.2 51.2h104.8c26.8 0 51.2-21.9 51.2-51.2-2.4-26.8-24.3-48.8-51.1-48.8" style="fill:#fbbc04"/><circle cx="176.8" cy="343.8" r="51.2" style="fill:#ea8600"/><path d="M432.8 0H79.2C47.5 0 20.7 26.8 20.7 58.5S47.5 117 79.2 117h353.5c31.7 0 58.5-26.8 58.5-58.5S464.5 0 432.8 0" style="fill:#4285f4"/><circle cx="432.8" cy="58.5" r="58.5" style="fill:#185abc"/></svg>' },
    "usmobile": { name: "US Mobile", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M251.7 165.6c5.4 0 9.8-4.3 9.8-9.7 0-5.3-4.4-9.7-9.8-9.7s-9.8 4.3-9.8 9.7c.1 5.3 4.4 9.7 9.8 9.7" style="fill:#99999b"/><path d="M327.5 143.9h-.3v3.6c-.3 6.1-1.3 12-3.1 17.3-2.3 7.6-5.9 14.8-10.8 20.9-6.4 8.7-14.9 16.1-25 20.9-.3 0-.5.3-.5.3-.5.3-1 .5-1.8.8h-.3c-.5.3-.5.3-.8.3h-.3v-63.9h-70.3c-1.3 0-2.6 1-2.6 2.3v10.2c2.1-2.8 5.4-4.6 9.3-4.6 2.1 0 4.1.5 5.7 1.5.3 0 .5.3.8.3.8.5 1.3 1 1.8 1.3q3.15 2.25 5.4 5.4l3.6 5.6 7.2 11.5-19.5 30.2c-1-.5-1.8-.8-3.1-1.5-9.8-5.1-18.3-12.2-25-20.9-4.6-6.4-8.2-13.2-10.8-20.9-1.5-5.4-2.6-10.7-3.1-16.6 0-1.5-.3-3.1-.3-4.3H.3l63.1 26.2 2.1.8 1.8 1.3 188.6 139.4 188.6-139.1 1.8-1.3 2.1-.8s63.6-26 63.6-26.2zm-75.5 4.3c3.3 0 6.2 2.8 6.2 6.1s-2.8 6.1-6.2 6.1c-3.3 0-6.2-2.8-6.2-6.1s2.9-6.1 6.2-6.1" style="fill:#e7e7e6"/><path d="m512 143.9-63.9 26.2-2.1.8-1.8 1.3-188.3 139.1L67 172.2l-1.8-1.3-2.1-.8L0 143.9c2.1 7.1 4.6 14 7.2 20.9l49.5 20.9h-40c3.6 7.1 7.5 14.3 11.9 20.9l85.3 20.9H43c5.7 7.4 11.6 14.3 17.8 20.9l110 21.4H83c9 7.6 18.6 14.5 28.6 20.9l116 20.9h-76.3c29.4 12.5 61.1 19.6 94.6 20.9h20c33.5-1.3 65.4-8.7 94.6-20.9h-76.3l116.2-20.9c10-6.4 19.6-13.5 28.6-20.9h-87.9l110-20.9c6.2-6.6 12.1-13.8 17.8-20.9H398l85.3-20.9c4.1-6.9 8.2-13.8 11.9-20.9H455l49.5-20.9c3.1-7.4 5.4-14.3 7.5-21.4" style="fill:#ced4d4"/><path d="M278 222.9H173.1l24.2 41.3H319l24.2-41.3z" style="fill:#0055a2"/><path d="M319 264.2h-41v70.1l22.7-38.7zm-83 0h-38.7l18.3 31.3 22.7 38.7v-70.1H236z" style="fill:#ce2832"/><path d="M238.3 264.2v70.1l19.8 34.1 19.8-34.1v-70.1zm19.9-32.7 3.3 6.9 7.5 1-5.4 5.4 1.3 7.4-6.7-3.6-7 3.6 1.5-7.4-5.7-5.4 7.7-1zm39.9 0 3.3 6.9 7.7 1-5.7 5.4 1.3 7.4-6.7-3.6-6.7 3.6 1.3-7.4-5.4-5.4 7.5-1zm-80.1 0 3.6 6.9 7.5 1-5.4 5.4 1.3 7.4-7-3.6-6.7 3.6 1.3-7.4-5.4-5.4 7.5-1z" style="fill:#f2f2f2"/></svg>' },
    "boostmobile": { name: "Boost Mobile", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M101.1 137.5c-26.4 5-48.2 16.3-66.4 34.4-15.4 15.4-26.1 33.7-31.8 54.4C.2 235.7 0 238 0 255.6s.2 19.9 2.8 29.4c3.6 13.3 12.1 30.8 20 41.3 39 52.1 114.8 65 170.8 28.9 9.4-6.1 10.9-7.5 77.9-72.3 79.3-76.7 78.8-76.2 86.4-80.4 9.1-5.1 20.1-7.9 30.5-7.9 11.4 0 17.8 1.5 28.2 6.4 16.5 7.8 29.5 24 33.7 41.9 2.1 9 1.4 23.1-1.7 32.1-2.7 7.7-10.7 20.2-16.2 25-6.7 5.9-15.3 10.8-23.1 13.4-6.3 2.1-9.7 2.5-20 2.5-23.2 0-32.3-4.6-57.6-29.3l-17.4-17-4.4 4c-2.4 2.2-12.1 11.7-21.6 21l-17.2 17 17.1 16.6c9.4 9.1 20.5 19.2 24.7 22.4 23.5 18 57.1 27.6 86.5 24.7 31.9-3.2 56.5-14.6 78.2-36.1 16-16 25.8-32.9 31.7-54.6 2.4-8.9 2.7-12 2.7-28.1 0-15.4-.3-19.4-2.2-27.2-10.7-42.2-41.2-75-81.6-87.8-14.7-4.7-26.6-6.1-44-5.5-26.8 1-49.5 8.5-70.7 23.5-8.1 5.7-9.7 7.2-82.2 77.4-73.1 70.8-70.5 68.3-78.5 72.4-10.7 5.5-18.9 7.5-31 7.4-28.3-.1-51.8-17.9-60-45.3-2.5-8.2-2.5-23.6 0-32 6.3-21.4 25.3-38.9 47.1-43.5 10.8-2.3 26.1-1.4 35.2 1.9 11.3 4.2 16 7.6 34.8 25.5 9.9 9.4 18.4 17.3 18.9 17.5s10.5-8.9 22.1-20.1l21.2-20.4-13.2-13.3c-29.7-30-46.1-40.5-74.5-47.9-12.8-3.2-39.2-4.1-52.3-1.6" style="fill-rule:evenodd;clip-rule:evenodd;fill:#fc5404"/></svg>' },
    "costco": { name: "Costco", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M512 29.2C468.2 16.5 418.5 9.5 368.9 9.5 192.3 9.5 31.8 121 4 260.4c-27.2 136.2 85.9 242 257.7 242 39.2 0 121.8-5.7 159.6-19l42.1-178.7c-40.6 27.3-83.9 44.4-134.3 44.4-65.5 0-114.1-40.6-103.6-93.2 10.4-51.9 72.1-93.2 137.6-93.2 49.5 0 89 22.2 119 48.2z" style="fill:#e31837"/></svg>' },
    "walmart": { name: "Walmart", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M256 172.4c11.9 0 22-6.2 23.3-14.2l11.8-134C291.1 10.9 275.5 0 256 0c-19.6 0-35.1 10.9-35.1 24.1l11.9 134c1.3 8 11.3 14.3 23.2 14.3m-72.6 41.9c5.9-10.5 5.6-22.1-.8-27.3L72.2 109.8c-11.5-6.7-28.7 1.3-38.5 18.2s-7.8 35.8 3.4 42.4l122.3 56.7c7.8 2.9 18.1-2.5 24.1-12.9m145.1 0c6.3 10.4 16.5 15.8 24.1 13L475 170.4c11.4-6.7 13.1-25.5 3.5-42.3-9.8-16.9-27.1-24.8-38.6-18.3L329.4 187c-6.1 5.3-6.6 16.9-.7 27.4M256 339.7c11.9 0 22 6.2 23.3 14.2l11.8 134c0 13.3-15.6 24-35.1 24-19.6 0-35.1-10.8-35.1-24l11.9-134c1.3-7.9 11.3-14.2 23.2-14.2m72.6-41.8c6.3-10.4 16.5-15.9 24.1-12.9L475 341.7c11.4 6.6 13.1 25.5 3.5 42.4-9.8 16.8-27.1 24.8-38.6 18.2L329.4 325c-6.1-5.2-6.6-16.8-.8-27.1m-145.2-.1c5.9 10.4 5.6 22-.8 27.3L72.2 402.2c-11.5 6.7-28.7-1.3-38.5-18.1-9.8-16.9-7.8-35.8 3.4-42.4L159.4 285c7.8-3 18 2.5 24 12.8" style="fill:#ffc220"/></svg>' },
    "amazon": { name: "Amazon", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M443.4 421.5C232.1 522 100.9 437.9 16.9 386.8c-5.2-3.2-14 .8-6.4 9.6C38.6 430.3 130.2 512 249.9 512s191-65.3 199.9-76.7c8.8-11.3 2.5-17.6-6.4-13.8m59.3-32.8c-5.7-7.4-34.5-8.8-52.7-6.5-18.2 2.2-45.5 13.3-43.1 19.9 1.2 2.5 3.7 1.4 16.2.3 12.5-1.2 47.6-5.7 54.9 3.9s-11.2 55.4-14.6 62.8c-3.3 7.4 1.2 9.3 7.4 4.4 6.1-4.9 17-17.7 24.4-35.7 7.4-18.2 11.8-43.5 7.5-49.1" style="fill:#ff6200"/><path d="M421.8 318.6c-12.4-17.2-25.5-31.1-25.5-62.8V150.2c0-44.7 3.2-85.7-29.8-116.5-26-24.9-69-33.7-102-33.7C200.1 0 128.2 24 113 103.7c-1.5 8.5 4.6 13 10.1 14.2l65.7 7c6.1-.3 10.6-6.3 11.7-12.4 5.6-27.5 28.7-40.7 54.5-40.7 13.9 0 29.7 5.1 38 17.6 9.4 13.9 8.2 33 8.2 49.1v8.8c-39.3 4.4-90.6 7.3-127.4 23.5-42.4 18.3-72.2 55.7-72.2 110.7 0 70.4 44.4 105.6 101.4 105.6 48.3 0 74.5-11.4 111.7-49.3 12.4 17.9 16.4 26.5 38.9 45.2 5 2.7 11.5 2.4 16-1.6l.1.2c13.5-12 38.1-33.5 51.9-45 5.5-4.6 4.6-11.9.2-18m-133.2-30.5c-10.8 19.1-27.8 30.8-46.9 30.8-26 0-41.2-19.8-41.2-49.1 0-57.7 51.7-68.2 100.7-68.2v14.7h.1c0 26.4.7 48.4-12.7 71.8" style="fill-rule:evenodd;clip-rule:evenodd"/></svg>' },
    "kohls": { name: "Kohl's", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M0 92.1h168.8v112.6h1.1L298.6 92.1h189.2L332.3 230.2 512 419.9H298.6L169.9 285.6h-1.1V420H0z" style="fill:#860035"/></svg>' },
    "audible": { name: "Audible", bg: "#F8991C", ink: "#111111", kind: "", path: "M12.008 17.362L24 9.885v2.028l-11.992 7.509L0 11.912V9.886l12.008 7.477zm0-9.378c-2.709 0-5.085 1.363-6.448 3.47.111-.111.175-.175.286-.254 3.374-2.804 8.237-2.17 10.883 1.362l1.758-1.124c-1.394-2.044-3.786-3.454-6.48-3.454m0 3.47a4.392 4.392 0 0 0-3.548 1.821 3.597 3.597 0 0 1 2.139-.697c1.299 0 2.455.666 3.232 1.79l1.679-1.045c-.729-1.157-2.028-1.87-3.501-1.87M3.897 8.412c4.943-3.897 11.929-2.836 15.652 2.344l.031.032 1.822-1.125a11.214 11.214 0 0 0-9.394-5.085c-3.897 0-7.366 1.996-9.394 5.085.364-.412.824-.903 1.283-1.251" },
    "crunchyroll": { name: "Crunchyroll", bg: "#FF5E00", ink: "#ffffff", kind: "", path: "M2.909 13.436C2.914 7.61 7.642 2.893 13.468 2.898c5.576.005 10.137 4.339 10.51 9.819q.021-.351.022-.706C24.007 5.385 18.64.006 12.012 0S.007 5.36 0 11.988 5.36 23.994 11.988 24q.412 0 .815-.027c-5.526-.338-9.9-4.928-9.894-10.538Zm16.284.155a4.1 4.1 0 0 1-4.095-4.103 4.1 4.1 0 0 1 2.712-3.855 8.95 8.95 0 0 0-4.187-1.037 9.007 9.007 0 1 0 8.997 9.016q-.001-.847-.15-1.651a4.1 4.1 0 0 1-3.278 1.63Z" },
    "fubotv": { name: "FuboTV", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="m.9 239.7 7.5-36.5 20.9.5c6.3-39.8 32.6-55 77.4-49L99.8 191l-16.8-.3c-8.3.3-12.8 4.9-14 13l21.8-.1-6.9 36.1-22.3.3-22.5 115.1-39.1.1 22.3-115.7zm102.7-37.8h41.1L129 283.1c-3.1 17.2-6.4 36.2 14 39.8 5.7.8 11.5 0 17-2.6 16.6-7.8 20.6-24.3 24-40.9l15.7-77.4 39.4-.1-30.2 152.2-36.1.5 1.6-7.5c-24 15.9-53.2 13.8-70.7 2.2-16.9-12-20.8-32.9-16.5-59.5zm118.6 152.7 38.6-.1 2.3-12.3c23.7 25.7 78 17.2 96.9.3-10.4-10.7-14.8-23.4-16.5-37-13.4 17.6-39.8 19.7-53.4 9.2-12.8-9.1-16.1-27.2-12.8-43 3-14.2 12.3-26.8 25.9-32.2 16.1-6.5 35.3-2.3 44.8 10.2 15.9 26 3.1 47.6 14.3 70.9 6.6 13.8 19.7 25.6 33.6 31.6 16.7 7.2 37.2 8.6 56.1 3.1 22.2-6.5 40.5-22.5 50.6-43.3 12-24.7 12.8-55.3.3-78.3-20.8-38-77.5-47.3-112.5-20.4 8.8 10.9 12.8 23.5 15.6 36.7 14.5-19.3 42.6-17 55.8-5.3 11.3 10 14.4 33.2 6 51.5-6.6 14.2-18.5 21.9-33.6 24.2-26.6 4.1-40.8-17.3-42.1-39.7-.3-22.3-2.1-38.3-10.3-51.3-5.6-8.9-14.8-17.1-24.1-21.9-20.2-10.4-48.7-11.2-68.4 1l10.4-53.7-38.8-.1z" style="fill-rule:evenodd;clip-rule:evenodd;fill:#eb3401"/></svg>' },
    "tidal": { name: "Tidal", bg: "#000000", ink: "#ffffff", kind: "", path: "M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996 4.004 12l4.004-4.004L12.012 12l-4.004 4.004 4.004 4.004 4.004-4.004L12.012 12l4.004-4.004-4.004-4.004zM16.042 7.996l3.979-3.979L24 7.996l-3.979 3.979z" },
    "pandora": { name: "Pandora", bg: "#224099", ink: "#ffffff", kind: "", path: "M1.882 0v24H8.32a1.085 1.085 0 001.085-1.085v-4.61h1.612c7.88 0 11.103-4.442 11.103-9.636C22.119 2.257 17.247 0 12.662 0H1.882Z" },
    "deezer": { name: "Deezer", bg: "#A238FF", ink: "#ffffff", kind: "", path: "M.693 10.024c.381 0 .693-1.256.693-2.807 0-1.55-.312-2.807-.693-2.807C.312 4.41 0 5.666 0 7.217s.312 2.808.693 2.808ZM21.038 1.56c-.364 0-.684.805-.91 2.096C19.765 1.446 19.184 0 18.526 0c-.78 0-1.464 2.036-1.784 5-.312-2.158-.788-3.536-1.325-3.536-.745 0-1.386 2.704-1.62 6.472-.442-1.932-1.083-3.145-1.793-3.145s-1.35 1.213-1.793 3.145c-.242-3.76-.874-6.463-1.628-6.463-.537 0-1.013 1.378-1.325 3.535C6.938 2.036 6.262 0 5.474 0c-.658 0-1.247 1.447-1.602 3.665-.217-1.291-.546-2.105-.91-2.105-.675 0-1.221 2.807-1.221 6.272 0 3.466.546 6.273 1.221 6.273.277 0 .537-.476.736-1.273.32 2.928.996 4.938 1.776 4.938.606 0 1.143-1.204 1.507-3.11.251 3.622.875 6.195 1.602 6.195.46 0 .875-1.023 1.187-2.677C10.142 21.6 11 24 12.004 24c1.005 0 1.863-2.4 2.235-5.822.312 1.654.727 2.677 1.186 2.677.728 0 1.352-2.573 1.603-6.195.364 1.906.9 3.11 1.507 3.11.78 0 1.455-2.01 1.775-4.938.208.797.46 1.273.737 1.273.675 0 1.22-2.807 1.22-6.273-.008-3.457-.553-6.272-1.23-6.272ZM23.307 10.024c.381 0 .693-1.256.693-2.807 0-1.55-.312-2.807-.693-2.807-.381 0-.693 1.256-.693 2.807s.312 2.808.693 2.808Z" },
    "amazonmusic": { name: "Amazon Music", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M56.9 148.6c13.7 0 23.8 7.7 29.1 20.8h1.1c8.2-14 18.1-20.8 30.8-20.8 20.8 0 33.4 17.5 33.4 45.6v68.5c0 2.1-1.5 3.6-3.6 3.6h-22.2c-2.1 0-3.6-1.5-3.6-3.6v-66.3c0-13.4-5.3-20.9-15.1-20.9-10.8 0-16.5 8.7-16.5 24.8v62.4c0 2.1-1.5 3.6-3.6 3.6H64.5c-2.1 0-3.6-1.5-3.6-3.6v-66.3c0-13.4-5.3-20.9-15.1-20.9-10.8 0-16.5 8.7-16.5 24.8v62.4c0 2.1-1.5 3.6-3.6 3.6H3.6c-2.1 0-3.6-1.5-3.6-3.6v-108c0-2.1 1.5-3.6 3.6-3.6h18.3c2.1 0 3.4 1.4 3.9 3.6l2.8 13.6h1.1c4.9-12.7 14.5-19.7 27.2-19.7m202 6.1v108c0 2.1-1.5 3.6-3.6 3.6H237c-2.2 0-3.4-1.4-3.9-3.6l-2.8-13.6h-1.1c-5 12.9-14.7 19.7-27.7 19.7-20.8 0-33.5-17-33.5-44.9v-69.2c0-2.1 1.5-3.6 3.6-3.6h22.2c2.1 0 3.6 1.5 3.6 3.6v67c0 13.2 5.3 20.4 15.2 20.4 11.1 0 16.9-8.3 16.9-24.2v-63.1c0-2.1 1.5-3.6 3.6-3.6h22.2c2-.2 3.6 1.4 3.6 3.5m72.3 29c-1.4-7.6-7.2-12.1-15.1-12.1s-13.2 4.2-13.2 10.3c0 5.7 4.2 9.3 12.7 11.5l16.2 4c20.1 5 28.7 16.5 28.7 33.7 0 21.7-18.6 37.7-43.4 37.7-22.6 0-41.4-11.8-44.7-36.8-.3-2.2.8-3.7 3-4.2l19.1-3.6c2.5-.5 3.9.6 4.4 3.6 1.9 12.1 8.6 17.9 18.1 17.9 8.7 0 14.8-4.6 14.8-12 0-7.2-4.3-11.1-13.3-13.3l-12.1-2.9c-24.4-5.9-32.3-17.7-32.3-33.8 0-22.5 18.6-35.1 41.7-35.1 24 0 37.8 12.3 42 30.1.6 2.5-.3 4-2.8 4.4l-19.9 3.3c-2 .4-3.7-.5-3.9-2.7m57.6-76.1c9.4 0 17.2 6.4 17.2 17.2 0 10.5-7.8 17.2-17.2 17.2s-17.2-6.6-17.2-17.2c0-10.8 7.8-17.2 17.2-17.2m-14.7 155v-108c0-2.1 1.5-3.6 3.6-3.6h22.2c2.1 0 3.6 1.5 3.6 3.6v108c0 2.1-1.5 3.6-3.6 3.6h-22.2c-2.1 0-3.6-1.5-3.6-3.6m137.8-32.5c-5 24.9-23.3 38.6-44.6 38.6-28.5 0-49.9-25.9-49.9-60.1 0-34.1 21.3-60 49.9-60 21.3 0 39.6 13.7 44.6 38.6.4 2.4-.7 3.9-2.9 4.3l-20.1 3.6c-2.2.4-3.6-.6-4.2-2.9-3-14-9.1-20.2-17.5-20.2-12.7 0-19.4 13-19.4 36.6 0 23.7 6.6 36.7 19.4 36.7 8.3 0 14.4-6.2 17.5-20.2.6-2.4 1.9-3.3 4.2-2.9l20.1 3.6c2.2.4 3.3 1.9 2.9 4.3m-137.2 94c1.4 3.2 5.4 3.2 11.6 1.9 16.6-3.6 37.7-3.9 41.3 1.1 3.5 5.1-4.2 24.8-13.2 39.2-3.3 5.5-4.7 9-1.9 11.6.7.8 1.7 1.1 2.8 1.2 3.3 0 7.6-3.3 11.6-7.1 8.7-7.6 15.5-17.3 19.2-28.2 3.7-10.5 5.5-25.3 1.7-31-3.7-5.4-18.3-9-29.5-8.9-11.8 0-23.1 2.9-33.4 8.3-6.3 3.6-12.1 7.5-10.2 11.9m-307.3-5.8c1 2.9 3.2 6.5 6.5 10.7 42.5 52.4 110.9 75.4 177 75.4 57.8 0 113.6-17.4 149-48.2 6.1-5.4 9.3-9.7 9.3-13 0-1.4-.6-2.5-1.5-3.6-3-3.2-7.6-.8-13.2 2.1-33 17.3-83.6 29.2-137.5 29.2-60.8 0-125.9-15.1-175.2-54.8-4.7-3.7-9.8-7.5-13.3-4.7-1.2 1-2.4 3-1.1 6.9" style="fill:#25d1da"/></svg>' },
    "dropbox": { name: "Dropbox", bg: "#0061FF", ink: "#ffffff", kind: "", path: "M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" },
    "backblaze": { name: "Backblaze", bg: "#E21E29", ink: "#ffffff", kind: "", path: "M9.3108.0003c.6527 1.3502 1.5666 4.0812-1.3887 7.1738-1.8096 1.8796-3.078 3.8487-2.3496 6.0644.3642 1.1037 1.1864 2.5079 2.8867 2.7852.6107.1008 1.3425-.0006 1.7403-.1406 2.4538-.8544 2.098-3.4138 1.5546-5.0469-.07-.2129-.1915-.7333-.2363-.9238-.3726-1.6023.776-2.6562 1.129-3.8047.028-.0925.0534-.1819.0702-.2715.042-.21.067-.423.0781-.6387 0-1.8264-.9882-2.6303-1.7754-3.5996C10.1794.5643 9.3107.0003 9.3107.0003Zm6.2754 6.0175s-.709.3366-1.2188.8829c-.4454.4818-.8635.8789-1.2949 1.8593-.028.14-.0518.2863-.0742.4375-.2325 1.6416 1.1473 3.1446.7187 5.1895-.112.535-.3554.7123-.7812 1.6367-.5098 1.1065-.383 2.588.3594 3.5293.6723.8488 1.879 1.2321 3.0527.9492 2.1065-.5042 3.0646-2.2822 2.8965-4.2851-.1317-1.58-.8154-2.7536-2.754-4.961-.9607-1.0925-1.6072-2.409-1.5624-3.4062.1373-1.2074.6582-1.832.6582-1.832zM4.8928 15.1936c-.0222.0145-.0439.0614-.0586.1602a.0469.0469 0 0 1-.0059.0195v.01c-.1148.5406-.1649 1.823.1153 2.9687.353 1.4427 1.4175 3.902 4.412 5.129 2.5184 1.0336 5.718.5411 7.8497-1.627.5294-.5435.408-.4897-.4883-.2012v-.002c-1.1121.3558-3.5182.5463-4.7676-1-1.5239-1.8852-.4302-3.3633-1.3574-3.1504-3.6164.8348-5.2667-1.4657-5.5469-2.1016-.0023-.002-.0857-.2487-.1523-.205z" },
    "1password": { name: "1Password", bg: "#145FE4", ink: "#ffffff", kind: "", path: "M12 0c6.627 0 12 5.373 12 12 0 6.628-5.373 12-12 12S0 18.628 0 12C0 5.373 5.373 0 12 0m-.893 4.86c-.485 0-.727.001-.913.095a.87.87 0 0 0-.378.379c-.094.185-.095.428-.095.912v2.747c0 .12 0 .182.016.238q.02.075.065.138a1 1 0 0 0 .175.162l.695.564c.113.092.17.139.19.194a.22.22 0 0 1 0 .15c-.02.056-.077.102-.19.194l-.695.564a1 1 0 0 0-.175.162.4.4 0 0 0-.065.138 1 1 0 0 0-.016.238v6.019c0 .485 0 .728.095.913a.87.87 0 0 0 .378.378c.186.094.428.094.913.094h1.786c.485 0 .727 0 .913-.094a.87.87 0 0 0 .378-.378c.095-.185.095-.428.095-.913v-2.747c0-.12 0-.182-.016-.238a.4.4 0 0 0-.065-.138 1 1 0 0 0-.175-.162l-.695-.564c-.113-.092-.17-.138-.191-.193a.22.22 0 0 1 0-.152c.02-.055.078-.1.19-.193l.696-.564a1 1 0 0 0 .175-.162.4.4 0 0 0 .065-.138 1 1 0 0 0 .016-.238V6.246c0-.484 0-.727-.095-.912a.87.87 0 0 0-.378-.379c-.186-.094-.428-.094-.913-.094Z" },
    "chatgpt": { name: "ChatGPT", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M.1 122.9C.1 55 55.1 0 123 0h265.9c67.9 0 122.9 55 122.9 122.9V512H123C55.1 512 .1 457 .1 389.1z" style="fill:#74aa9c"/><path d="m421 220.7-.1-.1c8.5-26.2 5.4-54.8-8.4-78.5-21.1-36.5-63.3-55.4-104.5-46.7l-.1.1c-18.4-20.5-44.7-32.1-72.2-32-42.2 0-79.6 27.1-92.6 67.1v.2c-26.9 5.7-50.1 22.7-63.8 46.6-21.2 36.4-16.5 82.4 11.7 113.7l.1.1c-8.5 26.2-5.4 54.8 8.4 78.5 21.1 36.5 63.3 55.4 104.5 46.7l.1-.1c18.4 20.5 44.7 32.1 72.2 32 42.2 0 79.6-27.1 92.6-67.1v-.2c26.9-5.7 50.1-22.7 63.8-46.6C453.9 298 449.2 252 421 220.7m-126.9 57.2-38.1 22-38.1-22v-44l38.1-22 38.1 22zm96.7-123.4h-.2c8.4 14.6 11.5 31.6 8.7 48.2l-78.7-45.4c-.9-.5-1.8-.9-2.8-1.2-3.3-1.1-7-.7-10.1 1.2l-89.8 51.9v-37.9l74.2-42.9c7.2-4.2 15-7 23.1-8.5l-.1-.2c29.2-5.4 59.9 7.7 75.7 34.8m-155.2-66-.1.1c16.9 0 33.1 5.8 46.1 16.5L203 150.6q-1.35.75-2.4 1.8c-2.6 2.3-4.1 5.7-4.1 9.4v103.7l-32.8-18.9v-85.7c0-8.3 1.4-16.5 4.2-24.2l-.2-.1c9.8-28 36.5-48.1 67.9-48.1M100.8 189.8v.2c8.4-14.6 21.6-25.8 37.4-31.7v90.9c0 1 .1 2 .4 3 .7 3.4 2.9 6.4 6.1 8.2l89.8 51.9-32.8 19-74.2-42.8c-7.2-4.1-13.6-9.5-18.9-15.8l-.2.2c-19.2-22.7-23.2-55.8-7.6-83.1m20.4 167.4h.2c-8.4-14.6-11.5-31.6-8.7-48.2l78.7 45.4c.9.5 1.8.9 2.8 1.2 3.3 1.1 7 .7 10.1-1.2l89.8-51.9v37.9l-74.2 42.9c-7.2 4.2-15 7-23.1 8.5l.1.2c-29.2 5.5-59.9-7.6-75.7-34.8m155.2 66.1.1-.1c-16.9 0-33.1-5.8-46.1-16.5l78.7-45.4q1.35-.75 2.4-1.8c2.6-2.3 4.1-5.7 4.1-9.4V246.3l32.8 18.9v85.7c0 8.3-1.4 16.5-4.2 24.2l.2.1c-9.9 28-36.6 48.1-68 48.1M411.2 322v-.2c-8.4 14.6-21.6 25.8-37.4 31.7v-90.9c0-1-.1-2-.4-3-.7-3.4-2.9-6.4-6.1-8.2l-89.8-51.9 32.8-19 74.2 42.8c7.2 4.1 13.6 9.5 18.9 15.8l.2-.2c19.2 22.7 23.2 55.8 7.6 83.1" style="fill:#fff"/></svg>' },
    "claude": { name: "Claude", bg: "#D97757", ink: "#ffffff", kind: "", path: "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" },
    "xboxgamepass": { name: "Xbox Game Pass", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M53.3 0h405.3c29.2-.3 53.1 23.2 53.3 52.4v407.2c-.2 29.2-24.1 52.7-53.3 52.4H53.3c-29.2.3-53-23.2-53.3-52.4V52.4C.2 23.2 24.1-.2 53.3 0" style="fill:#107c10"/><path d="M186.3 83.4c-35.7 35.2-39.7 91.4-9.3 131.3.2.1.4.1.5 0q.15-.3 0-.6c-7.7-23.4 31.3-80 51.2-104.2v-.8c-33.9-33.4-42.7-25.8-42.7-26m140 .3c35.7 35.2 39.7 91.4 9.3 131.3-.2.1-.4.1-.5 0q-.15-.3 0-.6c7.5-23.4-31.1-80.4-51.2-104.2v-.8c33.9-33.4 42.7-25.8 42.7-26M256 54.7c18.4-.1 36.5 5 52.1 14.7q.15.3 0 .6h-.6c-19.2-4.2-48.6 12.4-51.4 14.1h-.1c-7.3-4.2-34.4-18.5-51.6-14.1-.2.1-.4.1-.5 0q-.15-.3 0-.6c15.7-9.7 33.7-14.8 52.1-14.7m0 79.9h.4c30 22.9 81 78.8 65.4 94.8-37.4 32.9-93.5 32.9-130.9 0-15.5-16 35.5-71.9 65.1-94.6m-63.6 255.4c-4-2.6-8.8-3.9-13.5-3.7h-30v69.9h7.8V427h20.7c5.9.2 11.8-1.7 16.4-5.3 4.1-3.8 6.3-9.2 6-14.8.7-6.5-2.2-12.8-7.4-16.7m-35.7 3.7h22c6.7-.7 12.6 4.2 13.3 10.9q.15 1.05 0 2.1c.1 3.1-1 6.2-3.1 8.6-2.9 3-7 4.5-11.1 4.2h-21.3v-25.8zm69.5-7.3h-6.9l-28.2 69.9h8.4l8.4-21.3H237l8.4 21.3h8.4zm-15.5 41.3 12.1-30.6 11.5 30.6zm75.1-10.6c-.5 0-1.1 0-1.7-.4-12.1-2.3-19.4-4.6-19.4-12.6-.1-3.9 1.9-7.6 5.3-9.5 7.9-4 17.3-3.6 24.9 1.1 3.5 2.7 5.4 6.9 5.3 11.3v1.9h7.9v-2c-.6-14.1-10.7-22.3-27.3-22.3-12.1 0-24.2 6-24.2 19.6-.3 5.9 2.8 11.4 8.1 14.2 5 2.6 10.4 4.4 16 5.3h1.1c12.4 2.6 20.1 4.8 20.1 13.4.2 4.2-2 8.1-5.7 10.2-3.5 1.9-7.5 3-11.5 2.9-6.6.5-13.1-1.7-18.1-6.1-2.9-3.2-4.3-7.5-3.8-11.8v-2h-7.5v1.8c-.4 6.4 1.8 12.7 6.2 17.4 11.4 9 27.1 10.4 39.9 3.5 5.5-3.4 8.9-9.5 8.7-16-.2-15-14-17.7-24.3-19.9m61.8 0c-.6-.1-1.1-.2-1.7-.4-12.1-2.3-19.4-4.6-19.4-12.6-.1-3.9 1.9-7.6 5.3-9.5 7.9-4 17.3-3.6 24.9 1.1 3.5 2.7 5.4 6.9 5.3 11.3v1.9h7.8v-2c-.5-14.1-10.7-22.3-27.2-22.3-12.1 0-24.2 6-24.2 19.6-.3 5.9 2.8 11.4 8.1 14.2 5 2.6 10.4 4.4 16 5.3h1.1c12.4 2.6 20.1 4.8 20.1 13.4.2 4.1-1.9 8-5.4 10.2-3.5 1.9-7.5 3-11.5 2.9-6.6.5-13.1-1.7-18.1-6.1-2.9-3.2-4.3-7.5-3.8-11.8v-2h-7.7v1.8c-.4 6.4 1.8 12.7 6.2 17.4 11.4 9 27.1 10.4 39.9 3.5 5.5-3.4 8.9-9.5 8.7-16-.3-15-14.1-17.7-24.4-19.9m-3.1-64v-25.8h38.4v-7h-38.4v-23.4h40.9v-6.7h-48.6v69.7H386v-6.8zm-25.4-62.9-24.3 58.5-24.6-58.5h-8.9v69.7h7.9v-54l22.3 54h6.6l22.1-53.8v53.8h7.9v-69.7zm-89.8 0h-6.9l-28 69.7h8.3l8.4-21.3h29.1l8.2 21.3h8.4zm-15.5 41.1 11.9-30.3 11.5 30.3zm-54.3-7.5v7.4h23c.2 6.1-2 12.1-6 16.6-4.5 4.4-10.7 6.8-17 6.6-3.8 0-7.6-.7-11.1-2.2-3-1.4-5.7-3.5-7.9-6-2.1-2.8-3.7-5.9-4.7-9.2-1.1-3.7-1.7-7.5-1.7-11.3-.1-7.4 2.1-14.7 6.4-20.7 4.5-5.8 11.5-9 18.8-8.7 10.3-.2 19.3 6.9 21.3 17h7.7v-.7c-1.1-6.9-4.8-13.1-10.2-17.4-5.5-4.1-12.2-6.3-19-6.2-4.8 0-9.6 1-14.1 2.9-4.1 1.9-7.8 4.6-10.7 8.1-5.7 7.3-8.7 16.3-8.6 25.6 0 4.7.8 9.4 2.3 13.9 1.4 4.2 3.6 8.1 6.4 11.5 6.1 7 15 10.9 24.3 10.7 5.9.1 11.7-1.4 16.8-4.4 2.5-1.5 4.8-3.5 6.6-5.8v8.7h7.3V324z" style="fill:#fff"/></svg>' },
    "playstation": { name: "PlayStation", bg: "#0070D1", ink: "#ffffff", kind: "", path: "M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.39-1.502zm4.656 16.241l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.205 1.5V14.98l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661 1.848.601 2.04 1.472 1.576 2.072-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107V18.86zM1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073-1.939.331-3.996.196-6.038-.479z" },
    "nintendoswitch": { name: "Nintendo Switch", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M432.5 512h-353C35.6 512 0 476.4 0 432.5v-353C0 35.6 35.6 0 79.5 0h353C476.4 0 512 35.6 512 79.5v353c0 43.9-35.6 79.5-79.5 79.5" style="fill:#dd2f28"/><path d="M146.2 65.3c-38.2 6.8-69 35.1-78.7 72.4-3.5 13.4-3.7 21.3-3.3 125.5.2 95.7.3 98 1.9 105.4 8.8 39.8 37.1 68.2 77.4 77.6 5.2 1.2 11.9 1.4 54.9 1.7 44.5.3 49.1.2 50.3-1s1.3-16.5 1.3-190.5c0-129-.2-189.7-.8-190.8-.8-1.4-2.1-1.5-48.7-1.4-37.9 0-49.3.2-54.3 1.1m72 190.8v161.1l-32.4-.4c-29.8-.3-33-.5-39-2-25.6-6.6-44.6-26.3-49.9-52-1.8-8-1.8-205.8-.1-213.7 4.8-22.3 20.3-40.9 41.2-49.2 10.5-4.2 15.3-4.7 49.4-4.8l30.8-.1zm-65.1-112.5c-5 .9-12.6 4.8-16.7 8.3-8.3 7.2-12.5 17.5-11.8 29.6.3 6.3.7 7.9 3.3 13 3.7 7.7 9.4 13.4 17.1 17.2 5.3 2.6 6.7 2.9 13.6 3.2 6.3.2 8.5 0 12.7-1.4 17.2-5.8 27.7-22.6 24.7-39.8-3.5-20.4-22.9-34.1-42.9-30.1m135.6-79c-.3.2-.6 86.4-.6 191.5 0 173.4.1 191 1.3 191.5 2.1.8 63.8.5 71.5-.3 32.3-3.7 60.7-23.3 76.2-52.5 2-3.7 4.6-10 6-13.9 5-14.9 4.9-11 4.9-125.2 0-91.2-.2-104.8-1.3-110.6-7.9-41.4-39.4-72.7-80.9-79.8-5.6-.9-14.1-1.2-41.8-1.2-19.1-.1-35 .1-35.3.5m84.9 173.1c12.4 3.3 22.6 12.7 26.7 24.8 2.6 7.5 2.5 18.4-.1 25.3-4.9 12.6-14.4 21.4-26.6 24.6-19.9 5.2-41-6.8-46.8-26.6-1.8-6-1.7-16.2.3-22.4 6-19.4 26.6-30.9 46.5-25.7" style="fill:#fff"/></svg>' },
    "strava": { name: "Strava", bg: "#FC4C02", ink: "#ffffff", kind: "", path: "M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" },
    "patreon": { name: "Patreon", bg: "#000000", ink: "#ffffff", kind: "", path: "M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604C2.357 3.231 1.093 7.391 1.046 11.54c-.039 3.411.302 12.396 5.369 12.46 3.765.047 4.326-4.804 6.068-7.141 1.24-1.662 2.836-2.132 4.801-2.618 3.376-.836 5.678-3.501 5.673-7.031Z" },
    "thenewyorktimes": { name: "The New York Times", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M447.3 68.8c0-55-52.3-68.8-93.6-68.8v8.3c24.8 0 44 8.3 44 27.5-.7 16.1-14.4 28.5-30.5 27.8-.9 0-1.7-.1-2.6-.2-31.1-3.3-61.7-10.7-90.8-22-31-11.7-63.4-19.1-96.3-22C127.9 17.3 86 56 84 105.6c0 .6 0 1.1-.1 1.7-.4 26.9 16.1 51.1 41.3 60.6l2.8-5.5c-10.5-5-17.1-15.9-16.5-27.5 2.4-18.9 19.6-32.4 38.5-30.3 34.9 3.8 69.1 12.2 101.8 24.8 33.4 9.6 67.4 17 101.8 22v85.3l-41.3 35.8v2.8l41.3 35.8v118.4c-20.9 11.9-44.8 17.6-68.8 16.5-40.6 2.1-80-14-107.4-44l112.9-55.1V154.1l-137.6 60.6c15.4-33.1 40.3-60.9 71.6-79.8l-2.8-5.5C133 150.9 69.1 228.2 64.7 319.3 65 425.6 151.1 511.7 257.4 512c98.9 1.4 180.2-77.6 181.7-176.4v-2.5h-5.5C419 368.2 394.1 398 362 418.4V305.5l44-35.8V267l-41.3-35.8v-82.6c43.4 2.2 80.3-31.3 82.5-74.6.1-1.7.1-3.5.1-5.2M207.8 371.6l-33 16.5c-21.8-30.4-32.5-67.3-30.3-104.6-.2-19.6 2.6-39.1 8.3-57.8l57.8-24.8z"/></svg>' },
    "ring": { name: "Ring", bg: "#1C9AD6", ink: "#ffffff", kind: "", path: "M24 16.375a3.05 3.05 0 0 1-.246 1.231 3.114 3.114 0 0 1-1.672 1.66 3.068 3.068 0 0 1-1.225.247 3.695 3.695 0 0 1-.71-.073 4.05 4.05 0 0 1-.739-.218 3.184 3.184 0 0 1-.676-.37 2.02 2.02 0 0 1-.507-.515.46.46 0 0 1-.08-.275.442.442 0 0 1 .152-.346.504.504 0 0 1 .346-.138.553.553 0 0 1 .201.04.392.392 0 0 1 .186.17.046.046 0 0 0 .016.032l.064.065a1.806 1.806 0 0 0 .798.507 3.052 3.052 0 0 0 .943.154 2.12 2.12 0 0 0 .846-.17 2.189 2.189 0 0 0 1.16-1.16 2.115 2.115 0 0 0 .176-.841v-1.109a3.132 3.132 0 0 1-.985.637 3.089 3.089 0 0 1-1.193.234 3.046 3.046 0 0 1-1.231-.246 3.137 3.137 0 0 1-1.66-1.66 3.04 3.04 0 0 1-.247-1.232v-2.544a3.058 3.058 0 0 1 .247-1.225 3.154 3.154 0 0 1 .668-1 3.202 3.202 0 0 1 .986-.669 3.15 3.15 0 0 1 2.463 0 3.09 3.09 0 0 1 1.668 1.668 3.066 3.066 0 0 1 .246 1.225v5.92zm-.967-5.92a2.118 2.118 0 0 0-.17-.846 2.189 2.189 0 0 0-1.16-1.16 2.201 2.201 0 0 0-1.692 0 2.191 2.191 0 0 0-1.166 1.16 2.134 2.134 0 0 0-.168.845v2.531a2.133 2.133 0 0 0 .168.853 2.194 2.194 0 0 0 .468.693 2.171 2.171 0 0 0 .694.467 2.201 2.201 0 0 0 1.692 0 2.189 2.189 0 0 0 1.16-1.16 2.117 2.117 0 0 0 .174-.853zm-7.252 5.356a.435.435 0 0 1-.154.363.511.511 0 0 1-.66 0 .434.434 0 0 1-.153-.363v-5.356a2.118 2.118 0 0 0-.17-.846 2.189 2.189 0 0 0-1.16-1.16 2.201 2.201 0 0 0-1.692 0 2.19 2.19 0 0 0-1.16 1.16 2.127 2.127 0 0 0-.17.846v5.356a.434.434 0 0 1-.152.363.511.511 0 0 1-.661 0 .434.434 0 0 1-.153-.363v-5.356a3.058 3.058 0 0 1 .246-1.225 3.163 3.163 0 0 1 .67-1 3.202 3.202 0 0 1 .984-.669 3.15 3.15 0 0 1 2.464 0 3.091 3.091 0 0 1 1.667 1.668 3.066 3.066 0 0 1 .247 1.225zm-8.383 0a.435.435 0 0 1-.152.363.511.511 0 0 1-.662 0 .434.434 0 0 1-.152-.363V7.956a.435.435 0 0 1 .152-.363.512.512 0 0 1 .662 0 .436.436 0 0 1 .152.363zM4.982 8.44a.463.463 0 0 1-.145.338.483.483 0 0 1-.355.142.503.503 0 0 1-.339-.145l-.016-.017a.149.149 0 0 0-.032-.024.123.123 0 0 1-.033-.025 1.9 1.9 0 0 0-1.24-.43q-.871 0-1.363.595-.491.596-.492 1.693v5.243a.435.435 0 0 1-.153.363.525.525 0 0 1-.33.123.525.525 0 0 1-.33-.123.434.434 0 0 1-.153-.363v-5.243A4.362 4.362 0 0 1 .18 9.303a3.034 3.034 0 0 1 .53-1.031 2.546 2.546 0 0 1 .878-.706 2.763 2.763 0 0 1 1.231-.257 3.08 3.08 0 0 1 1.065.209 2.573 2.573 0 0 1 .934.58.48.48 0 0 1 .163.343zm2.76-3.128a.826.826 0 0 1-.826.827.826.826 0 0 1-.827-.827.826.826 0 0 1 .827-.826.826.826 0 0 1 .826.826Z" },
    "nordvpn": { name: "NordVPN", bg: "#4687FF", ink: "#ffffff", kind: "", path: "M2.2838 21.5414A11.9866 11.9866 0 010 14.4832C0 7.8418 5.3727 2.4586 12 2.4586c6.6279 0 12 5.3832 12 12.0246a11.9853 11.9853 0 01-2.2838 7.0582l-5.7636-9.3783-.5565.9419.5645 2.6186L12 8.9338l-2.45 4.1447.5707 2.6451-2.0764-3.5555-5.7605 9.3733z" },
    "proton": { name: "Proton", bg: "#6D4AFF", ink: "#ffffff", kind: "", path: "M2.474 17.75V24h4.401v-5.979c0-.582.232-1.14.645-1.551a2.204 2.204 0 0 1 1.556-.643h4.513a7.955 7.955 0 0 0 5.612-2.318 7.907 7.907 0 0 0 2.325-5.595 7.91 7.91 0 0 0-2.325-5.596A7.958 7.958 0 0 0 13.587 0H2.474v7.812h4.401V4.129h6.416c.995 0 1.951.394 2.656 1.097.704.7 1.1 1.653 1.101 2.646a3.742 3.742 0 0 1-1.101 2.648 3.766 3.766 0 0 1-2.656 1.097H8.627a6.158 6.158 0 0 0-4.352 1.795 6.133 6.133 0 0 0-1.801 4.338Z" },
    "uber": { name: "Uber", bg: "#000000", ink: "#ffffff", kind: "", path: "M0 7.97v4.958c0 1.867 1.302 3.101 3 3.101.826 0 1.562-.316 2.094-.87v.736H6.27V7.97H5.082v4.888c0 1.257-.85 2.106-1.947 2.106-1.11 0-1.946-.827-1.946-2.106V7.971H0zm7.44 0v7.925h1.13v-.725c.521.532 1.257.86 2.06.86a3.006 3.006 0 0 0 3.034-3.01 3.01 3.01 0 0 0-3.033-3.024 2.86 2.86 0 0 0-2.049.861V7.971H7.439zm9.869 2.038c-1.687 0-2.965 1.37-2.965 3 0 1.72 1.334 3.01 3.066 3.01 1.053 0 1.913-.463 2.49-1.233l-.826-.611c-.43.577-.996.847-1.664.847-.973 0-1.753-.7-1.912-1.64h4.697v-.373c0-1.72-1.222-3-2.886-3zm6.295.068c-.634 0-1.098.294-1.381.758v-.713h-1.131v5.774h1.142V12.61c0-.894.544-1.47 1.291-1.47H24v-1.065h-.396zm-6.319.928c.85 0 1.564.588 1.756 1.47H15.52c.203-.882.916-1.47 1.765-1.47zm-6.732.012c1.086 0 1.98.883 1.98 2.004a1.993 1.993 0 0 1-1.98 2.001A1.989 1.989 0 0 1 8.56 13.02a1.99 1.99 0 0 1 1.992-2.004z" },
    "lyft": { name: "Lyft", bg: "#FF00BF", ink: "#ffffff", kind: "", path: "M4.38 15.883c.036.042.125.135.125.135s-.094.059-.152.086a3.046 3.046 0 0 1-1.28.286C1.593 16.39 0 15.29 0 12.878v-8.78h3.512v9.365c0 .95.306 1.781.867 2.42zM24 11.122V7.61h-1.253c-.524-2.76-3.425-4.574-6.341-3.484-1.624.607-2.943 2.548-2.943 4.282v7.979a1608.8 1608.8 0 0 0 .153 0 3.495 3.495 0 0 0 2.38-1.077c.632-.658.98-1.522.98-2.432h1.463V9.366h-1.463V8.4c0-.375.198-.726.526-.909.9-.5 1.815.143 1.815.996v3.22c0 1.273.48 2.456 1.354 3.329a4.666 4.666 0 0 0 3.178 1.351H24v-3.51a1.17 1.17 0 0 1-1.17-1.17v-.586H24zm-14.927 1.17a.585.585 0 0 1-1.17 0V7.61H4.39v5.853a2.928 2.928 0 0 0 4.83 2.224c-.055.433-.294.792-.69 1.04-.373.234-.857.357-1.402.357a3.83 3.83 0 0 1-1.65-.382s-.093-.044-.21-.11v3.119a6.65 6.65 0 0 0 2.468.484c1.312 0 2.51-.41 3.371-1.155.967-.836 1.478-2.056 1.478-3.528V7.61H9.073v4.683z" },
    "doordash": { name: "DoorDash", bg: "#FF3008", ink: "#ffffff", kind: "", path: "M23.071 8.409a6.09 6.09 0 00-5.396-3.228H.584A.589.589 0 00.17 6.184L3.894 9.93a1.752 1.752 0 001.242.516h12.049a1.554 1.554 0 11.031 3.108H8.91a.589.589 0 00-.415 1.003l3.725 3.747a1.75 1.75 0 001.242.516h3.757c4.887 0 8.584-5.225 5.852-10.413" },
    "irs": { name: "IRS", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M487.4 90.1c-5.7-9.9-66.1-37.2-153.2-55-35.9 38.2-35.9 53.4-36.6 59.8-.6 6.4 11.8 22.6 24.8 39.1 23.8 30.5 30.2 36.2 33.7 45.5 7 17.5-4.5 56.9-12.7 93.2 0 0-21.3-76.9-31.2-126.9-.8-2.5-.4-5.1 1-7.3-53.7-5.1-90-7.6-96.3 20.3-24.8 0-35.9 7-38.5 11.1-6.4 10.5 1.3 32.1 5.4 42.9 3.5-8.6 25.4-7 32.7-6.7s3.2 1.9 4.1 3.8v104.3H157l-55 146.2c25.4 12.1 52.1 21.6 68.7 21.6s57.5-21.3 63.3-21.6c5.7-.3 46.7 21.6 63.6 21.6s42.9-8.3 68.7-21.6l-54.7-146.2h-63.3v-98.9c-1-6.7-4.1-8.9-6.4-9.2H274c-4.8-18.8-11.1-31.8-20-32.7 2.3-3.2 5.1-6.1 8.3-8.6h-24.8c2.5-13 34.7-8.3 48.6-7.3 14.3 70.3 41 164.4 42.3 166s23.8 9.9 26.7 10.2c13-28 32.7-110.6 34-130.7 16.5 5.7 9.9 27.7 6.4 49.3-18.8 113.5-33.4 147.5-37.8 168.5 16.5-3.5 26.7-6.4 28.3-8.3s10.2-21.6 16.8-42.9c9.5-30.8 25.4-109 24.5-139.6 0-7.3-6.4-14.9-17.5-20.7 3-5 5.8-10.2 8.3-15.6 2.8-7.1 5.3-14.3 7.3-21.6 6.4 1.9 12.1 4.8 13 11.1 3.5 29.9 1.6 32.4-1.9 87.4-1 17.5-7.3 52.1-13.7 88.4-11.8 66.8-22.9 95.1-22.9 105.2 17.5-5.7 30.8-9.9 32.1-12.1s14.6-35.3 23.8-83.9c3.8-20.7 6.7-41.3 10.2-62.3 4.1-26.8 6.1-53.9 5.7-81.1 0-35.3 4.1-35.6-21.9-49.3 9.9-28.9 7.9-47.7 5.4-53.1s-9.9-10.2-33.1-8.6c8.3 7.6 5.7 23.5 3.8 32.7-4.5-3.8-2.9-10.2-27.3-9.2-3.8-40.1-11.1-44.5-12.1-45.8s-23.8-2.5-30.2 0c4.5 2.9 13.7 34.7 9.2 46.7-2.9-3.8-37.5-42.9-35-50.2s3.8-9.2 15.6-23.2c41.3 7.3 111.9 33.4 115.7 41 5.6 11.1 9.3 23 10.8 35.3 3.8 23.2 10.8 78.2 7.3 162.1S465 439 465.3 436.4c13-4.1 34.3-23.5 35.9-28 5.4-14.3 8.3-65.2 10.2-111.9s-3.2-105.6-5.7-127.5c-7.2-52.8-11-66.8-18.3-78.9M171.1 451.6c-12.4 0-32.1-1.9-32.1-1.9l32.1-92.2 29.6 92.2c-.4 0-18.2 1.9-29.6 1.9m158.6-1.9s-19.7 1.9-32.1 1.9-29.6-1.9-29.6-1.9l29.6-92.2zM248 377.8v-35.3h27.7l-41.3 114.8-41-114.8h27.3v25.1c-.1.9.3 1.9 1 2.5l4.5 1.9zm3.5-186.3h-47.7c-3.5-11.1-.3-14 10.2-14.9 19.4-1.9 35.9-1.9 37.5 14.9m134.2-50.2c17.5-2.9 9.2 28 4.8 40.1-5.4-13.4-12.8-26-21.9-37.2 5.5-1.5 11.3-2.4 17.1-2.9M77.6 395.6c8.3-8.6 37.5-38.8 42-55s10.2-65.8 10.2-76.3c0 0-28.9 19.4-44.2 35.3-6.4 7-15.6 18.8-15.6 18.8-2.9-16.5 1-35.3 8.3-46.7s45.5-46.1 50.2-58.5c7.6-19.7 6.4-37.2 13-58.8-23.8 7.6-53.1 26.1-67.1 41-1.9-23.2 5.4-40.4 21.3-52.5 22.6-17.2 52.1-27 71.5-32.4s43.2-10.2 56.9-16.8c24.8-12.1 48.6-45.8 54-63.6-7.9 0-37.2-1.9-65.8 9.5-10.2 4.1-15.3 13.7-20 21.3-4.8 7.6-9.9 14.6-14 20.3-10 15.7-25.9 26.8-44.2 30.8.6-1.6 11.8-8.3 20-26.1 6.3-15.1 11.5-30.6 15.6-46.4-15.6 1.9-25.1 6.4-41.3 13s-22.6 14-26.4 20.7c-10.8 17.8-8.3 67.1-31.2 86.5 1-26.1 6.4-54-2.9-86.5-47.5 18.8-56.4 35.3-52.9 56 4.1 26.7 34.7 39.1 47.7 61.4q3.9 7.95 5.7 16.5c1 .3-9.2 13.4-6.4 38.5-5.4-10.4-11.6-20.4-18.4-29.9-14-18.1-41.3-46.4-41.3-46.4-5.4 72.8 3.5 86.8 7.3 93.2 8.9 15.6 43.2 39.7 50.5 53.7 3.5 7.6 4.5 10.5 4.5 10.2s-7 12.1-5.4 24.5c.3 4.5 1.6 10.2 2.5 16.8-7.4-10.7-15.4-21-23.8-30.8C25.2 322.2.4 305 .4 305c-1.6 7.9 2.5 48.6 3.5 55 3.2 20.7 4.1 39.7 21 56.9 16.8 17.2 62.6 34.7 72.8 38.2-1.7-7.5-3.8-15-6.4-22.3-5.4-14.9-14-37.2-13.7-37.2" style="fill:#00599c"/></svg>' },
    "ynab": { name: "YNAB", bg: "#FFFFFF", ink: "#111111", kind: "", art: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M413.3 234.5h-93.6c-2 0-4.5 1.4-5.5 3.1L258 328.9c-1 1.7-2.7 1.7-3.7 0l-55.5-91.3c-1-1.7-3.5-3.1-5.5-3.1H99.2c-2 0-2.7 1.3-1.6 3l110.9 163.1c1.1 1.6 2 4.6 2 6.5V505c0 2 1.6 3.6 3.6 3.6h84.1c2 0 3.6-1.6 3.6-3.6v-97.9c0-2 .9-4.9 2-6.5l111-163.1c1.2-1.6.5-3-1.5-3M249.8 93.4c2.4 1.3 4.8 2.4 6.1 2.4 1.2 0 3.3-.7 6-2.4 53-33.5 8.9-74.5-6-90-15 15.5-59.1 56.5-6.1 90M194 215.5c3-.2 5.8-.7 6.9-1.4s2.6-2.6 4-5.8c27.4-61.6-37.5-72.4-60.4-77.5-4 22.8-18.7 85.9 49.5 84.7M107.2 202c2.6-1.6 4.8-3.3 5.5-4.4.6-1.2 1-3.5.8-6.9-5-67-67.5-46.8-90.1-40.7 7.1 22 24.1 84.6 83.8 52M118 314.4c1.1-2.8 1.9-5.5 1.7-6.8s-1.3-3.4-3.6-6c-44.5-51-82.5 1.9-97.1 20.1 19.2 13.4 70.6 53.8 99-7.3m137.9-204c-11.7 13-46.2 47.5-4.7 75.7 1.9 1.1 3.8 2 4.7 2 1 0 2.6-.6 4.7-2 41.5-28.2 7-62.7-4.7-75.7M141.6 343.1c-.7-.5-2.1-.8-4.2-.8-41.6-.2-34.6 39.2-32.9 53.5 14.1-3.4 54-10.8 39.3-49.1-.7-1.7-1.5-3.2-2.2-3.6m109.5-67.5c1.9 1.1 3.8 2 4.7 2 1 0 2.6-.6 4.7-2 41.5-28.1 7-62.7-4.7-75.7-11.6 13-46.2 47.6-4.7 75.7m-175-21c1.3-1.8 2.4-3.5 2.5-4.5s-.4-2.6-1.6-4.8c-24.7-43.2-62.7-12.5-76.9-2.1 12 12.7 43.8 49.6 76 11.4m42.7-119c2.2-.2 4.3-.4 5.1-1s1.8-2 2.7-4.3C144.4 83.8 96 74.8 78.9 70.7c-2.1 17.3-10.4 65.1 39.9 64.9m68.1-15c2.5.4 4.8.7 5.8.3s2.5-1.7 4.1-4c32.1-45.8-18-68.4-35.6-77.4-6.9 18.2-29.1 68 25.7 81.1M311 214.1c1.1.7 3.9 1.2 6.9 1.4 68.2 1.3 53.5-61.9 49.5-84.7-22.9 5.1-87.7 16-60.4 77.5 1.4 3.1 2.9 5.1 4 5.8m87.6-23.4c-.2 3.4.1 5.7.8 6.9.6 1.2 2.9 2.8 5.5 4.4 59.7 32.5 76.7-30.1 83.9-52.1-22.7-6-85.2-26.2-90.2 40.8m-2.8 110.9c-2.2 2.6-3.4 4.7-3.6 6s.6 4 1.7 6.8c28.4 61.1 79.8 20.7 98.9 7.3-14.5-18.2-52.5-71-97-20.1m-21.3 40.6c-2.1 0-3.5.4-4.2.8s-1.5 1.9-2.2 3.6c-14.7 38.3 25.2 45.7 39.3 49.1 1.7-14.2 8.7-53.6-32.9-53.5m60.6-96.9c-1.2 2.2-1.7 3.9-1.6 4.8.1 1 1.2 2.7 2.5 4.5 32.2 38.2 64 1.2 76.1-11.4-14.3-10.3-52.3-41.1-77 2.1m-47-110.7c.8.5 2.9.8 5.1 1 50.4.2 42-47.5 39.9-64.8-17.1 4.1-65.5 13.1-47.7 59.5.9 2.3 1.9 3.7 2.7 4.3m-68.8-13.7c1 .4 3.3.2 5.8-.3 54.8-13.2 32.6-62.9 25.6-81.1-17.5 9-67.6 31.6-35.6 77.4 1.7 2.3 3.1 3.6 4.2 4" style="fill:#3b5eda"/></svg>' },
    "googleplay": { name: "Google Play", bg: "#414141", ink: "#ffffff", kind: "", path: "M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" },
    "appstore": { name: "App Store", bg: "#0D96F6", ink: "#ffffff", kind: "", path: "M8.8086 14.9194l6.1107-11.0368c.0837-.1513.1682-.302.2437-.4584.0685-.142.1267-.2854.1646-.4403.0803-.3259.0588-.6656-.066-.9767-.1238-.3095-.3417-.5678-.6201-.7355a1.4175 1.4175 0 0 0-.921-.1924c-.3207.043-.6135.1935-.8443.4288-.1094.1118-.1996.2361-.2832.369-.092.1463-.175.2979-.259.4492l-.3864.6979-.3865-.6979c-.0837-.1515-.1667-.303-.2587-.4492-.0837-.1329-.1739-.2572-.2835-.369-.2305-.2353-.5233-.3857-.844-.429a1.4181 1.4181 0 0 0-.921.1926c-.2784.1677-.4964.426-.6203.7355-.1246.311-.1461.6508-.066.9767.038.155.0962.2984.1648.4403.0753.1564.1598.307.2437.4584l1.248 2.2543-4.8625 8.7825H2.0295c-.1676 0-.3351-.0007-.5026.0092-.1522.009-.3004.0284-.448.0714-.3108.0906-.5822.2798-.7783.548-.195.2665-.3006.5929-.3006.9279 0 .3352.1057.6612.3006.9277.196.2683.4675.4575.7782.548.1477.043.296.0623.4481.0715.1675.01.335.009.5026.009h13.0974c.0171-.0357.059-.1294.1-.2697.415-1.4151-.6156-2.843-2.0347-2.843zM3.113 18.5418l-.7922 1.5008c-.0818.1553-.1644.31-.2384.4705-.067.1458-.124.293-.1611.452-.0785.3346-.0576.6834.0645 1.0029.1212.3175.3346.583.607.7549.2727.172.5891.2416.9013.1975.3139-.044.6005-.1986.8263-.4402.1072-.1148.1954-.2424.2772-.3787.0902-.1503.1714-.3059.2535-.4612L6 19.4636c-.0896-.149-.9473-1.4704-2.887-.9218m20.5861-3.0056a1.4707 1.4707 0 0 0-.779-.5407c-.1476-.0425-.2961-.0616-.4483-.0705-.1678-.0099-.3352-.0091-.503-.0091H18.648l-4.3891-7.817c-.6655.7005-.9632 1.485-1.0773 2.1976-.1655 1.0333.0367 2.0934.546 3.0004l5.2741 9.3933c.084.1494.167.299.2591.4435.0837.131.1739.2537.2836.364.231.2323.5238.3809.8449.4232.3192.0424.643-.0244.9217-.1899.2784-.1653.4968-.4204.621-.7257.1246-.3072.146-.6425.0658-.9641-.0381-.1529-.0962-.2945-.165-.4346-.0753-.1543-.1598-.303-.2438-.4524l-1.216-2.1662h1.596c.1677 0 .3351.0009.5029-.009.1522-.009.3007-.028.4483-.0705a1.4707 1.4707 0 0 0 .779-.5407A1.5386 1.5386 0 0 0 24 16.452a1.539 1.539 0 0 0-.3009-.9158Z" },
    // Monograms: initials on the brand's colour (as near its own as known), the ink reading at 4.5:1.
    "merrill": { name: "Merrill", bg: "#012169", ink: "#ffffff", kind: "investment", letters: "M" },
    "morganstanley": { name: "Morgan Stanley", bg: "#002B51", ink: "#ffffff", kind: "investment", letters: "MS" },
    "pnc": { name: "PNC", bg: "#EF7622", ink: "#111111", kind: "bank", letters: "P" },
    "truist": { name: "Truist", bg: "#2E1A47", ink: "#ffffff", kind: "bank", letters: "T" },
    "tdbank": { name: "TD Bank", bg: "#008A00", ink: "#ffffff", kind: "bank", letters: "TD" },
    "ally": { name: "Ally", bg: "#650360", ink: "#ffffff", kind: "bank", letters: "A" },
    "chime": { name: "Chime", bg: "#1EC677", ink: "#111111", kind: "bank", letters: "C" },
    "citizens": { name: "Citizens", bg: "#008555", ink: "#ffffff", kind: "bank", letters: "C" },
    "amc": { name: "AMC Theatres", bg: "#E31837", ink: "#ffffff", kind: "", letters: "AMC" },
    "synchrony": { name: "Synchrony", bg: "#FBC600", ink: "#111111", kind: "card", letters: "S" }
  };

  // web/src/finances/Mark.tsx
  var kindIcons = {
    checking: "M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6",
    savings: "M12 3v12M7 10l5 5 5-5M4 21h16",
    card: "M2 6h20v12H2zM2 10h20M6 15h4",
    cards: "M2 6h20v12H2zM2 10h20M6 15h4",
    investment: "M3 17l6-6 4 4 8-8M15 7h6v6",
    retirement: "M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10",
    loan: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
    loans: "M22 9 12 4 2 9l10 5 10-5zM6 11v5c3 2 9 2 12 0v-5",
    home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    car: "M5 17H3v-5l2.5-5h13l2.5 5v5h-2M7 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M13 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M3 12h18",
    utilities: "M13 2 4 14h7l-1 8 9-12h-7z",
    subscriptions: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
    spending: "M3 3h2l2.5 12h11L21 7H6.5M9 20h.01M18 20h.01",
    collectible: "M6 3h12l4 6-10 12L2 9zM11 3 8 9l4 12 4-12-3-6M2 9h20",
    other: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
    // What a payment is for, read from its name when no brand is.
    streaming: "M2 7h20v13H2zM7 2l5 5 5-5",
    music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    gaming: "M6 12h4M8 10v4M15 13h.01M18 11h.01M7 6h10a5 5 0 0 1 5 5v2a5 5 0 0 1-9 3h-2a5 5 0 0 1-9-3v-2a5 5 0 0 1 5-5z",
    news: "M4 4h13v16H6a2 2 0 0 1-2-2zM17 8h3v10a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h5",
    fitness: "M6 6v12M3 9v6M18 6v12M21 9v6M6 12h12",
    cloud: "M17.5 19H8a6 6 0 1 1 5.7-7.9A4.5 4.5 0 1 1 17.5 19z",
    software: "M4 5h16v11H4zM2 20h20M10 9l-2 2 2 2M14 9l2 2-2 2",
    food: "M7 2v20M4 2v5a3 3 0 0 0 6 0V2M17 22V2c-2.5 1-4 4-4 9h4",
    phone: "M7 2h10v20H7zM11 18h2",
    internet: "M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01",
    water: "M12 3s-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11z",
    heat: "M12 22a6 6 0 0 0 6-6c0-5-6-8-6-14-2 4-6 7-6 14a6 6 0 0 0 6 6z",
    insurance: "M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z",
    trash: "M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15",
    health: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z",
    school: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
    minus: "M5 12h14"
  };
  var hints = [
    ["spending", ["groceries", "grocery", "supermarket"]],
    ["insurance", ["insurance", "insure", "warranty"]],
    ["internet", ["internet", "wifi", "wi fi", "broadband", "fiber", "fibre", "isp"]],
    ["phone", ["phone", "phones", "mobile", "cell", "cellphone", "wireless"]],
    ["water", ["water", "sewer", "sewage"]],
    ["heat", ["gas", "propane", "heating", "heating oil"]],
    ["utilities", ["electric", "electricity", "power", "energy", "solar"]],
    ["trash", ["trash", "garbage", "recycling", "waste"]],
    ["home", ["rent", "hoa", "mortgage", "condo", "property tax", "lawn", "pest"]],
    ["streaming", ["streaming", "tv", "television", "cable", "movies", "movie", "films", "cinema", "theater", "theatre", "video"]],
    ["music", ["music", "radio", "audiobooks", "audiobook", "podcasts", "podcast"]],
    ["gaming", ["game", "games", "gaming"]],
    ["news", ["news", "newspaper", "magazine", "journal", "times", "gazette", "tribune"]],
    ["fitness", ["gym", "fitness", "yoga", "pilates", "workout", "crossfit", "climbing"]],
    ["cloud", ["cloud", "storage", "backup", "backups", "hosting", "server", "vps", "domain", "domains", "dns", "vpn", "seedbox"]],
    ["software", ["software", "app", "apps", "license", "antivirus", "password manager"]],
    ["food", ["meals", "meal kit", "meal", "restaurant", "coffee", "lunch", "snacks"]],
    ["health", ["health", "dental", "dentist", "vision", "medical", "therapy", "pharmacy", "doctor", "prescription", "prescriptions"]],
    ["school", ["tuition", "school", "daycare", "childcare", "preschool", "college", "lessons"]]
  ];
  var plainKinds = /* @__PURE__ */ new Set(["checking", "card", "investment", "retirement", "loan", "collectible"]);
  function hintOf(kind, name) {
    if (!name || kind && plainKinds.has(kind)) return void 0;
    const w3 = words(name);
    return hints.find(([, list]) => list.some((h3) => w3.includes(" " + h3 + " ")))?.[0];
  }
  function Mark2({ brand, kind, name, size }) {
    const b2 = brand ? brands[brand] : void 0;
    const cls = "fmark" + (size ? " " + size : "");
    if (b2?.art) return /* @__PURE__ */ u3("span", { class: cls + " logo art", "aria-hidden": "true", children: /* @__PURE__ */ u3("img", { src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(b2.art), alt: "" }) });
    if (b2?.letters) return /* @__PURE__ */ u3("span", { class: cls + " logo mono" + (b2.letters.length > 2 ? " three" : b2.letters.length > 1 ? " two" : ""), style: { background: b2.bg, color: b2.ink }, "aria-hidden": "true", children: b2.letters });
    if (b2) {
      return /* @__PURE__ */ u3("span", { class: cls + " logo", style: { background: b2.bg, color: b2.ink }, "aria-hidden": "true", children: /* @__PURE__ */ u3("svg", { viewBox: "0 0 24 24", children: /* @__PURE__ */ u3("path", { d: b2.path, fill: "currentColor" }) }) });
    }
    const glyph = hintOf(kind, name) || kind;
    const icon = glyph && kindIcons[glyph];
    if (icon) return /* @__PURE__ */ u3("span", { class: cls + " icon", "data-icon": glyph, "aria-hidden": "true", children: /* @__PURE__ */ u3("svg", { viewBox: "0 0 24 24", children: /* @__PURE__ */ u3("path", { d: icon }) }) });
    return /* @__PURE__ */ u3("span", { class: cls + " letter", "aria-hidden": "true", children: (name || "?").trim().charAt(0).toUpperCase() });
  }
  var words = (s3) => " " + s3.toLowerCase().replace(/\+/g, " plus ").replace(/&/g, " and ").replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " ";
  var aliases = {
    "amex": "americanexpress",
    "bofa": "bankofamerica",
    "att": "atandt",
    "hbo": "max",
    "hbo max": "max",
    "prime video": "amazonprimevideo",
    "prime": "amazonprime",
    "nyt": "thenewyorktimes",
    "ny times": "thenewyorktimes",
    "new york times": "thenewyorktimes",
    "openai": "chatgpt",
    "anthropic": "claude",
    "game pass": "xboxgamepass",
    "xbox": "xboxgamepass",
    "psn": "playstation",
    "ps plus": "playstation",
    "comcast": "xfinity",
    "youtube tv": "youtube",
    "youtube premium": "youtube",
    "amc theatres": "amc",
    "a list": "amc"
  };
  var named;
  var brandWords = () => named ??= [
    ...Object.keys(brands).map((k3) => [words(brands[k3].name), k3]),
    ...Object.entries(aliases).map(([a3, k3]) => [words(a3), k3])
  ].filter(([, k3]) => brands[k3]).sort((a3, b2) => b2[0].length - a3[0].length);
  function brandOf(institution, name) {
    if (institution) return institution;
    const w3 = words(name || "");
    return brandWords().find(([n2]) => w3.includes(n2))?.[1];
  }
  function Who({ name, n: n2, size }) {
    return /* @__PURE__ */ u3("span", { class: `fwho p${n2}` + (size ? " " + size : ""), "aria-hidden": "true", children: (name || "?").charAt(0).toUpperCase() });
  }
  function brandsFor(kind) {
    const want = { checking: ["bank"], savings: ["bank"], card: ["card", "bank"], investment: ["investment"], retirement: ["investment"], loan: ["bank"], car: ["car"], home: ["home"] }[kind];
    const byName = (list) => list.sort((a3, b2) => brands[a3].name.localeCompare(brands[b2].name));
    const fits = byName(Object.keys(brands).filter((k3) => want ? want.includes(brands[k3].kind) : !brands[k3].kind || brands[k3].kind === "card"));
    if (!want || kind === "car" || kind === "home") return fits;
    const makes = kind === "loan" ? byName(Object.keys(brands).filter((k3) => brands[k3].kind === "car")) : [];
    return [...fits, ...makes, ...byName(Object.keys(brands).filter((k3) => ["bank", "investment", "card"].includes(brands[k3].kind) && !fits.includes(k3)))];
  }
  var allBrands = () => Object.keys(brands).sort((a3, b2) => (brands[a3].kind ? 1 : 0) - (brands[b2].kind ? 1 : 0) || brands[a3].name.localeCompare(brands[b2].name));
  var brandName = (k3) => brands[k3]?.name || k3;

  // web/src/finances/money.ts
  var format = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  var code = "USD";
  function setCurrency(c3) {
    const want = (c3 || "USD").toUpperCase();
    if (want === code) return;
    try {
      format = new Intl.NumberFormat("en-US", { style: "currency", currency: want });
      code = want;
    } catch {
    }
  }
  var currencySign = () => format.formatToParts(0).find((p3) => p3.type === "currency")?.value || "$";
  var money = (n2) => (n2 < -5e-3 ? "−" : "") + format.format(Math.abs(n2));
  var whole = (n2) => (n2 <= -0.5 ? "−" : "") + currencySign() + Math.round(Math.abs(n2)).toLocaleString("en-US");
  function tick(n2) {
    const a3 = Math.abs(n2), sign = n2 <= -0.5 ? "−" : "";
    const trim = (x2) => String(+x2.toFixed(2));
    return sign + currencySign() + (a3 >= 1e6 ? `${trim(a3 / 1e6)}M` : a3 >= 1e3 ? `${trim(a3 / 1e3)}k` : String(Math.round(a3)));
  }
  function compact(n2) {
    const a3 = Math.abs(n2), sign = n2 <= -0.5 ? "−" : "";
    const s3 = a3 >= 1e6 ? `${(a3 / 1e6).toFixed(2)}M` : a3 >= 1e4 ? `${(a3 / 1e3).toFixed(1)}k` : a3 >= 1e3 ? `${(a3 / 1e3).toFixed(2)}k` : String(Math.round(a3));
    return sign + currencySign() + s3;
  }
  function parseAmount(typed) {
    let t3 = String(typed ?? "").replace(/[\s\u00a0\u202f']/g, "").replace(/[^0-9.,\-−]/g, "").replace("−", "-");
    const mark = t3.search(/[.,]\d{1,2}$/);
    if (mark >= 0) t3 = t3.slice(0, mark).replace(/[.,]/g, "") + "." + t3.slice(mark + 1);
    else t3 = t3.replace(/[.,]/g, "");
    return t3 === "" || t3 === "-" ? NaN : parseFloat(t3);
  }
  var cents = (n2) => Math.round(n2 * 100) / 100;
  var signed = (n2) => (n2 < -5e-3 ? "−" : "+") + money(Math.abs(n2));
  function split(n2) {
    const s3 = money(n2), i3 = s3.lastIndexOf(".");
    return i3 < 0 ? [s3, ""] : [s3.slice(0, i3), s3.slice(i3)];
  }
  var parseDay = (s3) => /* @__PURE__ */ new Date(s3 + "T00:00:00");
  var dayLong = (s3) => dayText(parseDay(s3), { weekday: "short", day: "numeric", month: "short" });
  var dayShort = (s3) => dayText(parseDay(s3), { day: "numeric", month: "short" });
  var monthName = (s3) => dayText(parseDay(s3), { month: "long" });
  var daysBetween = (a3, b2) => Math.round((parseDay(b2).getTime() - parseDay(a3).getTime()) / 864e5);
  var isoDay = (d3) => `${d3.getFullYear()}-${String(d3.getMonth() + 1).padStart(2, "0")}-${String(d3.getDate()).padStart(2, "0")}`;
  var todayISO = () => isoDay(/* @__PURE__ */ new Date());
  var plural2 = (n2, word) => `${n2} ${word}${n2 === 1 ? "" : "s"}`;
  var ordinal = (n2) => n2 + (n2 % 10 === 1 && n2 !== 11 ? "st" : n2 % 10 === 2 && n2 !== 12 ? "nd" : n2 % 10 === 3 && n2 !== 13 ? "rd" : "th");
  function scheduleText(s3, L2) {
    if (s3?.every === "paycheck") {
      const who = L2?.person[s3.person]?.name;
      return who ? `With each of ${who}'s paychecks` : "With each paycheck";
    }
    if (!s3?.start) return "";
    const d3 = parseDay(s3.start);
    const weekday = dayText(d3, { weekday: "long" });
    switch (s3.every) {
      case "once":
        return "Once, " + dayShort(s3.start);
      case "week":
        return "Every " + weekday;
      case "2 weeks":
        return "Every other " + weekday;
      case "twice a month":
        return `The ${ordinal(d3.getDate())} and ${ordinal(s3.day2 || 15)}`;
      case "month":
        return "Monthly on the " + ordinal(d3.getDate());
      case "3 months":
        return "Every 3 months on the " + ordinal(d3.getDate());
      case "year":
        return "Yearly on " + dayShort(s3.start);
    }
    return s3.every;
  }
  function perMonth(s3, people) {
    if (s3?.every === "paycheck") return perMonth((people || []).find((e3) => e3.id === s3.person)?.schedule);
    return { week: 52 / 12, "2 weeks": 26 / 12, "twice a month": 2, month: 1, "3 months": 1 / 3, year: 1 / 12 }[s3?.every] || 0;
  }
  function lookup(p3) {
    const by = (list) => Object.fromEntries((list || []).map((x2) => [x2.id, x2]));
    return { person: by(p3.people), order: Object.fromEntries((p3.people || []).map((e3, i3) => [e3.id, i3 % 4])), account: by(p3.accounts), payment: by(p3.payments) };
  }
  var saving = (kind) => kind === "savings" || kind === "investment" || kind === "retirement";
  var owed = (kind) => kind === "card" || kind === "loan";

  // web/src/finances/Edit.tsx
  var num = (s3) => {
    const n2 = parseAmount(s3);
    return isNaN(n2) ? 0 : n2;
  };
  var text = (n2) => n2 ? String(n2) : "";
  var input = (set2) => (e3) => set2(e3.target.value);
  var everies = [["month", "Monthly"], ["2 weeks", "Every 2 weeks"], ["week", "Weekly"], ["twice a month", "Twice a month"], ["3 months", "Every 3 months"], ["year", "Yearly"], ["once", "Once"]];
  var categories = [["home", "Home"], ["utilities", "Utilities"], ["car", "Car"], ["subscriptions", "Subscriptions"], ["loans", "Loans"], ["cards", "Cards"], ["spending", "Spending"], ["savings", "Saving"], ["other", "Other"]];
  var kindGroups = [
    { name: "Cash", kinds: [["checking", "Checking", "Where paychecks land and bills come out"], ["savings", "Savings", "Kept apart, earning interest"]] },
    { name: "Credit", kinds: [["card", "Credit card", "What it owes, and what is pending"], ["loan", "Loan", "A mortgage, a car loan, a student loan"]] },
    { name: "Investing", kinds: [["investment", "Investment", "A brokerage account, crypto"], ["retirement", "Retirement", "A 401(k), an IRA"]] },
    { name: "What you own", kinds: [["home", "Home", "What it is worth, and the loan against it"], ["car", "Car", "Picked by its make"], ["collectible", "Collectibles", "Trading cards, jewelry, art"], ["other", "Something else", "A boat, a share in a business"]] }
  ];
  var adding = { checking: "a checking account", savings: "a savings account", card: "a credit card", loan: "a loan", investment: "an investment account", retirement: "a retirement account", home: "a home", car: "a car", collectible: "collectibles", other: "something else" };
  var named2 = (kind, b2) => ({ checking: `${b2} Checking`, savings: `${b2} Savings`, investment: `${b2} brokerage`, retirement: `${b2} retirement`, loan: `${b2} loan` })[kind] || b2;
  var held = (kind) => kind === "home" || kind === "car" || kind === "collectible";
  function Actions3({ busy, exists, remove, close: close3, problem, touched, uses, removeAll }) {
    const [sure, setSure] = d2(false);
    const [leaving, setLeaving] = d2(false);
    const cancel = () => {
      if (touched && !leaving) setLeaving(true);
      else close3();
    };
    const asking = sure && !!uses && !!removeAll;
    const said = leaving && touched ? "Nothing here is saved yet. Cancel again to drop it, or Save." : asking ? `${uses} it. Delete them with it, or keep them: one out of it then comes out of checking, one into it goes nowhere, and a paycheck lands in checking.` : problem;
    return /* @__PURE__ */ u3(S, { children: [
      said && /* @__PURE__ */ u3("p", { class: "formerr " + (leaving || asking ? "warn" : "bad"), role: "alert", children: said }),
      /* @__PURE__ */ u3("div", { class: "actions finactions", children: [
        exists && (asking ? /* @__PURE__ */ u3(S, { children: [
          /* @__PURE__ */ u3("button", { type: "button", class: "small danger", disabled: busy, onClick: removeAll, children: "Delete it and them" }),
          /* @__PURE__ */ u3("button", { type: "button", class: "small danger", disabled: busy, onClick: remove, children: "Delete it, keep them" })
        ] }) : /* @__PURE__ */ u3("button", { type: "button", class: "small danger", disabled: busy, onClick: () => {
          if (sure) remove();
          else setSure(true);
        }, children: sure ? "Click again to delete" : "Delete" })),
        /* @__PURE__ */ u3("span", { class: "grow" }),
        /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: cancel, disabled: busy, children: "Cancel" }),
        /* @__PURE__ */ u3("button", { type: "submit", class: "primary small", disabled: busy, children: "Save" })
      ] })
    ] });
  }
  function useSaving(props) {
    const [busy, setBusy] = d2(false);
    const [touched, setTouched] = d2(false);
    const watch2 = {
      onInput: (e3) => {
        if (!e3.target.matches(".brandsearch")) setTouched(true);
      },
      onChange: (e3) => {
        if (!e3.target.matches(".brandsearch")) setTouched(true);
      },
      onClickCapture: (e3) => {
        if (e3.target.closest(".brandgrid button, .kindswap button, .dedrow button, button.addded")) setTouched(true);
      }
    };
    const keep2 = async (plan) => {
      setBusy(true);
      const ok = await props.save(plan);
      setBusy(false);
      if (ok) props.close();
    };
    return { busy, keep: keep2, touched, watch: watch2 };
  }
  function Field({ label, children, wide }) {
    return /* @__PURE__ */ u3("label", { class: "field" + (wide ? " wide" : ""), children: [
      label,
      children
    ] });
  }
  function MoneyField({ label, value, set: set2, hint }) {
    return /* @__PURE__ */ u3(Field, { label, children: /* @__PURE__ */ u3("span", { class: "moneyfield", children: [
      /* @__PURE__ */ u3("span", { "aria-hidden": "true", children: currencySign() }),
      /* @__PURE__ */ u3("input", { inputmode: "decimal", value, placeholder: hint || "0.00", onInput: input(set2) })
    ] }) });
  }
  function AccountSelect({ label, value, set: set2, accounts, none }) {
    return /* @__PURE__ */ u3(Field, { label, children: /* @__PURE__ */ u3("select", { value, onChange: input(set2), children: [
      none !== void 0 && /* @__PURE__ */ u3("option", { value: "", children: none }),
      accounts.map((a3) => /* @__PURE__ */ u3("option", { value: a3.id, children: a3.name }, a3.id))
    ] }) });
  }
  function ScheduleFields({ every, setEvery, start, setStart, day2: day22, setDay2, startLabel, people, person, setPerson }) {
    const pick = (v3) => {
      if (v3.startsWith("paycheck:")) {
        setEvery("paycheck");
        setPerson?.(v3.slice(9));
      } else setEvery(v3);
    };
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(Field, { label: "How often", children: /* @__PURE__ */ u3("select", { value: every === "paycheck" ? "paycheck:" + person : every, onChange: input(pick), children: [
        everies.map(([v3, t3]) => /* @__PURE__ */ u3("option", { value: v3, children: t3 }, v3)),
        (people || []).map((e3) => /* @__PURE__ */ u3("option", { value: "paycheck:" + e3.id, children: [
          "With each of ",
          e3.name,
          "'s paychecks"
        ] }, e3.id))
      ] }) }),
      every !== "paycheck" && /* @__PURE__ */ u3(Field, { label: startLabel, children: /* @__PURE__ */ u3("input", { type: "date", value: start, onInput: input(setStart), required: true }) }),
      every === "twice a month" && /* @__PURE__ */ u3(Field, { label: "And on day", children: /* @__PURE__ */ u3("input", { type: "number", min: "1", max: "31", value: day22, onInput: input(setDay2) }) })
    ] });
  }
  function PaymentForm(props) {
    const { plan, id: id2, checking } = props;
    const x2 = (plan.payments || []).find((p3) => p3.id === id2);
    const [name, setName] = d2(x2?.name || "");
    const [brand, setBrand] = d2(brandOf(x2?.institution, x2?.name) || "");
    const picked = A2(!!x2?.institution);
    const rename = (n2) => {
      setName(n2);
      if (!picked.current) setBrand(brandOf(void 0, n2) || "");
    };
    const [amount, setAmount] = d2(text(x2?.amount));
    const [estimate, setEstimate] = d2(!!x2?.estimate);
    const [every, setEvery] = d2(x2?.schedule.every || "month");
    const [person, setPerson] = d2(x2?.schedule.person || "");
    const [start, setStart] = d2(x2?.schedule.start || todayISO());
    const [day22, setDay2] = d2(String(x2?.schedule.day2 || 15));
    const [kind, setKind] = d2(x2?.kind || "home");
    const [from, setFrom] = d2(x2?.from || checking || "");
    const [to, setTo] = d2(x2?.to || "");
    const [card, setCard] = d2(x2?.card || "");
    const { busy, keep: keep2, touched, watch: watch2 } = useSaving(props);
    const [problem, setProblem] = d2("");
    const accounts = plan.accounts || [];
    const submit = (e3) => {
      e3.preventDefault();
      const wrong = !name.trim() ? "Give it a name." : !card && num(amount) <= 0 ? "Type how much it is." : card && card === from ? "A card can't pay itself off: pick the account it comes out of." : every === "twice a month" && !(num(day22) >= 1 && num(day22) <= 31) ? "The second day is 1 to 31." : every === "twice a month" && num(day22) === parseDay(start).getDate() ? "The second day is the first one again: pick another." : "";
      setProblem(wrong);
      if (wrong) return;
      const p3 = {
        id: x2?.id || "",
        name: name.trim(),
        amount: num(amount),
        estimate,
        kind,
        institution: brand || void 0,
        schedule: { every, start, day2: every === "twice a month" ? num(day22) : void 0, person: every === "paycheck" ? person : void 0 },
        from: from === checking ? void 0 : from || void 0,
        to: to || void 0,
        card: card || void 0
      };
      const list = (plan.payments || []).slice();
      const at = list.findIndex((q2) => q2.id === x2?.id);
      if (at >= 0) list[at] = p3;
      else list.push(p3);
      keep2({ ...plan, payments: list });
    };
    const remove = () => keep2({ ...plan, payments: (plan.payments || []).filter((q2) => q2.id !== x2?.id) });
    return /* @__PURE__ */ u3("form", { class: "finform", onSubmit: submit, ...watch2, children: [
      /* @__PURE__ */ u3("div", { class: "formhead", children: [
        /* @__PURE__ */ u3(Mark2, { brand, kind, name: name || "Payment", size: "lg" }),
        /* @__PURE__ */ u3("h2", { id: "finSheetTitle", children: x2 ? x2.name : "Add a payment" })
      ] }),
      /* @__PURE__ */ u3(BrandPick, { kind, value: brand, set: (k3) => {
        picked.current = true;
        setBrand(k3);
        if (k3 && !name.trim()) setName(brandName(k3));
      }, payment: true }),
      /* @__PURE__ */ u3("div", { class: "formgrid", children: [
        /* @__PURE__ */ u3(Field, { label: "Name", children: /* @__PURE__ */ u3("input", { value: name, onInput: input(rename), placeholder: "Mortgage", required: true }) }),
        /* @__PURE__ */ u3(MoneyField, { label: card ? "Other spending on it each time (each pays the balance)" : "Amount", value: amount, set: setAmount }),
        /* @__PURE__ */ u3(Field, { label: "Category", children: /* @__PURE__ */ u3("select", { value: kind, onChange: input(setKind), children: categories.map(([v3, t3]) => /* @__PURE__ */ u3("option", { value: v3, children: t3 }, v3)) }) }),
        /* @__PURE__ */ u3(ScheduleFields, { every, setEvery, start, setStart, day2: day22, setDay2, startLabel: x2 ? "Starting" : "Next on", people: plan.people, person, setPerson }),
        /* @__PURE__ */ u3(AccountSelect, { label: "Comes out of, or is charged to", value: from, set: setFrom, accounts: accounts.filter((a3) => (a3.kind === "card" || !owed(a3.kind)) && !held(a3.kind)), none: accounts.length ? void 0 : "Checking" }),
        /* @__PURE__ */ u3(AccountSelect, { label: "Goes into", value: to, set: setTo, accounts: accounts.filter((a3) => a3.id !== from && !held(a3.kind)), none: "Nowhere (a bill)" }),
        /* @__PURE__ */ u3(AccountSelect, { label: "Pays off a card", value: card, set: setCard, accounts: accounts.filter((a3) => a3.kind === "card"), none: "No" }),
        /* @__PURE__ */ u3("label", { class: "fcheckbox wide", children: [
          /* @__PURE__ */ u3("input", { type: "checkbox", checked: estimate, onChange: (e3) => setEstimate(e3.target.checked) }),
          " The amount changes each time (an estimate)"
        ] })
      ] }),
      /* @__PURE__ */ u3(Actions3, { busy, exists: !!x2, remove, close: props.close, problem, touched })
    ] });
  }
  function BrandPick({ kind, value, set: set2, payment }) {
    const [q2, setQ] = d2("");
    const grid = A2(null);
    _2(() => {
      if (!value) return void 0;
      const id2 = requestAnimationFrame(() => {
        const g2 = grid.current, on = g2?.querySelector(".on");
        if (g2 && on) g2.scrollTop += on.getBoundingClientRect().top - g2.getBoundingClientRect().top - 4;
      });
      return () => cancelAnimationFrame(id2);
    }, []);
    const all = payment ? allBrands() : brandsFor(kind);
    const want = q2.trim().toLowerCase();
    const shown5 = want ? all.filter((k3) => brandName(k3).toLowerCase().includes(want)) : all;
    const broker = kind === "investment" || kind === "retirement";
    const label = payment || kind === "home" ? "Logo" : kind === "car" ? "Make" : broker ? "Broker" : "Bank";
    const none = payment || kind === "home" ? "None" : kind === "car" ? "Another make" : broker ? "Another broker" : "Another bank";
    const what = payment ? "logos" : kind === "car" ? "makes" : "banks and brokers";
    return /* @__PURE__ */ u3("div", { class: "brandpick", children: [
      /* @__PURE__ */ u3("div", { class: "brandhead", children: [
        /* @__PURE__ */ u3("span", { children: label }),
        all.length > 9 && /* @__PURE__ */ u3("input", { type: "search", class: "brandsearch", value: q2, onInput: input(setQ), placeholder: `Search ${all.length} ${what}`, "aria-label": `Search ${what}` })
      ] }),
      /* @__PURE__ */ u3("div", { class: "brandgrid", ref: grid, role: "radiogroup", "aria-label": label, children: [
        (value && !shown5.includes(value) ? [value, ...shown5] : shown5).map((k3) => /* @__PURE__ */ u3("button", { type: "button", role: "radio", "aria-checked": value === k3, class: value === k3 ? "on" : "", onClick: () => set2(k3), children: [
          /* @__PURE__ */ u3(Mark2, { brand: k3, name: brandName(k3), size: "sm" }),
          /* @__PURE__ */ u3("span", { children: brandName(k3) })
        ] }, k3)),
        /* @__PURE__ */ u3("button", { type: "button", role: "radio", "aria-checked": !value, class: !value ? "on" : "", onClick: () => set2(""), children: [
          /* @__PURE__ */ u3(Mark2, { kind, name: none, size: "sm" }),
          /* @__PURE__ */ u3("span", { children: none })
        ] })
      ] }),
      !shown5.length && /* @__PURE__ */ u3("p", { class: "muted brandnone", children: [
        "None by that name: pick ",
        none,
        ", and type its name below."
      ] })
    ] });
  }
  function AccountForm(props) {
    const { plan, id: id2 } = props;
    const a3 = (plan.accounts || []).find((q2) => q2.id === id2);
    const [kind, setKind] = d2(a3?.kind || props.kind || "checking");
    const [step2, setStep] = d2(a3 || props.kind ? "form" : "kind");
    const form2 = A2(null);
    const moved = A2(false);
    _2(() => {
      if (!moved.current) {
        moved.current = true;
        return;
      }
      form2.current?.querySelector(step2 === "kind" ? "button.kindrow" : "input, select")?.focus();
    }, [step2]);
    const [name, setName] = d2(a3?.name || "");
    const [brand, setBrand] = d2(a3?.institution || "");
    const [balance, setBalance] = d2(text(a3?.balance));
    const [pending2, setPending2] = d2(text(a3?.pending));
    const [rate, setRate] = d2(text(a3?.rate));
    const [original, setOriginal] = d2(text(a3?.original));
    const [loan, setLoan] = d2(a3?.loan || "");
    const [detail, setDetail] = d2(a3?.detail || "");
    const { busy, keep: keep2, touched, watch: watch2 } = useSaving(props);
    const [problem, setProblem] = d2("");
    const loans = (plan.accounts || []).filter((q2) => q2.kind === "loan");
    const submit = (e3) => {
      e3.preventDefault();
      const wrong = !name.trim() && !brand ? "Give it a name, or pick its bank." : num(balance) < 0 && (owed(kind) || held(kind)) ? "Type it without a minus." : "";
      setProblem(wrong);
      if (wrong) return;
      const retyped = !a3 || num(balance) !== a3.balance || kind === "card" && num(pending2) !== (a3.pending || 0);
      const next = {
        id: a3?.id || "",
        kind,
        name: name.trim() || (brand ? named2(kind, brandName(brand)) : ""),
        institution: brand || void 0,
        balance: num(balance),
        detail: detail.trim() || void 0,
        updated: retyped ? todayISO() : a3?.updated,
        pending: kind === "card" ? num(pending2) : void 0,
        rate: kind === "savings" || kind === "loan" || kind === "card" ? num(rate) || void 0 : void 0,
        original: kind === "loan" ? num(original) : void 0,
        loan: kind === "home" || kind === "car" ? loan || void 0 : void 0
      };
      const list = (plan.accounts || []).slice();
      const at = list.findIndex((q2) => q2.id === a3?.id);
      if (at >= 0) list[at] = next;
      else list.push(next);
      keep2({ ...plan, accounts: list });
    };
    const usesIt = (x2) => !!a3 && [x2.from, x2.to, x2.card].includes(a3.id);
    const users = [
      ...(plan.payments || []).filter(usesIt).map((x2) => `“${x2.name}”`),
      ...(plan.people || []).filter((e3) => a3 && (e3.account === a3.id || (e3.deductions || []).some((d3) => d3.account === a3.id))).map((e3) => `${e3.name}'s paycheck`)
    ];
    const uses = users.length ? users.length > 3 ? `${users.slice(0, 3).join(", ")} and ${users.length - 3} more use` : users.length === 1 ? `${users[0]} uses` : `${users.slice(0, -1).join(", ")} and ${users.at(-1)} use` : void 0;
    const without = (drop) => keep2({
      ...plan,
      accounts: (plan.accounts || []).filter((q2) => q2.id !== a3?.id).map((q2) => q2.loan === a3?.id ? { ...q2, loan: void 0 } : q2),
      payments: (plan.payments || []).filter((x2) => !drop || !usesIt(x2)).map((x2) => ({ ...x2, from: x2.from === a3?.id ? void 0 : x2.from, to: x2.to === a3?.id ? void 0 : x2.to, card: x2.card === a3?.id ? void 0 : x2.card })),
      people: (plan.people || []).map((e3) => ({ ...e3, account: e3.account === a3?.id ? void 0 : e3.account, deductions: (e3.deductions || []).map((d3) => ({ ...d3, account: d3.account === a3?.id ? void 0 : d3.account })) }))
    });
    const remove = () => without(false);
    const owes = owed(kind), property = kind === "home" || kind === "car";
    const pick = (k3) => {
      setKind(k3);
      setBrand("");
      setStep("form");
    };
    if (step2 === "kind") {
      return /* @__PURE__ */ u3("form", { class: "finform", ref: form2, onSubmit: (e3) => e3.preventDefault(), children: [
        /* @__PURE__ */ u3("div", { class: "formhead", children: /* @__PURE__ */ u3("h2", { id: "finSheetTitle", children: "Add an account" }) }),
        /* @__PURE__ */ u3("p", { class: "formsub muted", children: "What are you adding?" }),
        /* @__PURE__ */ u3("div", { class: "kindlist", children: kindGroups.map((g2) => /* @__PURE__ */ u3("section", { class: "kindgroup", "aria-label": g2.name, children: [
          /* @__PURE__ */ u3("h3", { children: g2.name }),
          g2.kinds.map(([k3, t3, hint]) => /* @__PURE__ */ u3("button", { type: "button", class: "kindrow", onClick: () => pick(k3), children: [
            /* @__PURE__ */ u3(Mark2, { kind: k3, name: t3 }),
            /* @__PURE__ */ u3("span", { class: "grow", children: [
              /* @__PURE__ */ u3("strong", { children: t3 }),
              /* @__PURE__ */ u3("small", { children: hint })
            ] }),
            /* @__PURE__ */ u3("svg", { class: "chev", viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ u3("path", { d: "m9 6 6 6-6 6" }) })
          ] }, k3))
        ] }, g2.name)) }),
        /* @__PURE__ */ u3("div", { class: "actions finactions", children: [
          /* @__PURE__ */ u3("span", { class: "grow" }),
          /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: props.close, children: "Cancel" })
        ] })
      ] });
    }
    const said = name.trim() || (brand ? named2(kind, brandName(brand)) : "");
    return /* @__PURE__ */ u3("form", { class: "finform", ref: form2, onSubmit: submit, ...watch2, children: [
      /* @__PURE__ */ u3("div", { class: "formhead", children: [
        /* @__PURE__ */ u3(Mark2, { brand, kind, name: said || "Account", size: "lg" }),
        /* @__PURE__ */ u3("div", { class: "grow", children: [
          /* @__PURE__ */ u3("h2", { id: "finSheetTitle", children: a3 ? a3.name : `Add ${adding[kind] || "an account"}` }),
          !a3 && /* @__PURE__ */ u3("div", { class: "formsays muted", children: [
            said || "Its name, below",
            balance.trim() && ` · ${owes ? "owes " : ""}${money(num(balance))}`
          ] })
        ] }),
        !a3 && !props.kind && /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: () => setStep("kind"), children: "Change" })
      ] }),
      a3 && (a3.kind === "other" || a3.kind === "collectible") && /* @__PURE__ */ u3("div", { class: "kindswap", children: /* @__PURE__ */ u3(Segmented, { label: "Kind", value: kind, pick: setKind, options: [["collectible", "Collectibles"], ["other", "Something else"]] }) }),
      kind !== "other" && kind !== "collectible" && /* @__PURE__ */ u3(BrandPick, { kind, value: brand, set: setBrand }),
      /* @__PURE__ */ u3("div", { class: "formgrid", children: [
        /* @__PURE__ */ u3(Field, { label: "Name", children: /* @__PURE__ */ u3("input", { value: name, onInput: input(setName), placeholder: brand ? named2(kind, brandName(brand)) : { checking: "Chase Checking", savings: "Savings", card: "Chase Freedom", investment: "Brokerage", retirement: "401(k)", loan: "Car loan", home: "Home", car: "2022 RAV4", collectible: "Trading cards, jewelry", other: "A boat" }[kind], required: !brand }) }),
        /* @__PURE__ */ u3(MoneyField, { label: owes ? "Owed" : held(kind) ? "Worth" : "Balance", value: balance, set: setBalance }),
        kind === "card" && /* @__PURE__ */ u3(MoneyField, { label: "Pending", value: pending2, set: setPending2 }),
        kind === "savings" && /* @__PURE__ */ u3(Field, { label: "Interest, % a year", children: /* @__PURE__ */ u3("input", { inputmode: "decimal", value: rate, onInput: input(setRate), placeholder: "3.2" }) }),
        (kind === "loan" || kind === "card") && /* @__PURE__ */ u3(Field, { label: kind === "card" ? "Interest (APR), % a year, if it carries a balance" : "Interest (APR), % a year", children: /* @__PURE__ */ u3("input", { inputmode: "decimal", value: rate, onInput: input(setRate), placeholder: kind === "card" ? "24.99" : "6.5" }) }),
        kind === "loan" && /* @__PURE__ */ u3(MoneyField, { label: "Borrowed at the start", value: original, set: setOriginal }),
        property && /* @__PURE__ */ u3(AccountSelect, { label: "Loan against it", value: loan, set: setLoan, accounts: loans, none: "None" }),
        /* @__PURE__ */ u3(Field, { label: { home: "Address", car: "Year and model", card: "Last 4 digits", checking: "Last 4 digits", savings: "Last 4 digits" }[kind] || "Note", children: /* @__PURE__ */ u3("input", { value: detail, onInput: input(setDetail) }) })
      ] }),
      /* @__PURE__ */ u3(Actions3, { busy, exists: !!a3, remove, close: props.close, problem, touched, uses, removeAll: () => without(true) })
    ] });
  }
  function PersonForm(props) {
    const { plan, id: id2, checking } = props;
    const e3 = (plan.people || []).find((q2) => q2.id === id2);
    const [name, setName] = d2(e3?.name || "");
    const [net, setNet] = d2(text(e3?.net));
    const [gross, setGross] = d2(text(e3?.gross));
    const [every, setEvery] = d2(e3?.schedule.every || "2 weeks");
    const [start, setStart] = d2(e3?.schedule.start || todayISO());
    const [day22, setDay2] = d2(String(e3?.schedule.day2 || 15));
    const [account, setAccount] = d2(e3?.account || checking || "");
    const [deds, setDeds] = d2((e3?.deductions || []).map((d3) => ({ name: d3.name, amount: text(d3.amount), account: d3.account || "" })));
    const { busy, keep: keep2, touched, watch: watch2 } = useSaving(props);
    const accounts = (plan.accounts || []).filter((a3) => !owed(a3.kind) && !held(a3.kind));
    const [problem, setProblem] = d2("");
    const setDed = (i3, k3, v3) => setDeds(deds.map((d3, j3) => j3 === i3 ? { ...d3, [k3]: v3 } : d3));
    const submit = (ev) => {
      ev.preventDefault();
      const wrong = !name.trim() ? "Give their name." : num(net) <= 0 ? "Type the take-home pay on each check." : every === "twice a month" && !(num(day22) >= 1 && num(day22) <= 31) ? "The second day is 1 to 31." : every === "twice a month" && num(day22) === parseDay(start).getDate() ? "The second day is the first one again: pick another." : "";
      setProblem(wrong);
      if (wrong) return;
      const p3 = {
        id: e3?.id || "",
        name: name.trim(),
        net: num(net),
        gross: num(gross) || void 0,
        account: account === checking ? void 0 : account || void 0,
        schedule: { every, start, day2: every === "twice a month" ? num(day22) : void 0 },
        deductions: deds.filter((d3) => d3.name.trim()).map((d3) => ({ name: d3.name.trim(), amount: num(d3.amount), account: d3.account || void 0 }))
      };
      const list = (plan.people || []).slice();
      const at = list.findIndex((q2) => q2.id === e3?.id);
      if (at >= 0) list[at] = p3;
      else list.push(p3);
      keep2({ ...plan, people: list });
    };
    const remove = () => keep2({ ...plan, people: (plan.people || []).filter((q2) => q2.id !== e3?.id) });
    const taken = deds.reduce((t3, d3) => t3 + num(d3.amount), 0);
    return /* @__PURE__ */ u3("form", { class: "finform", onSubmit: submit, ...watch2, children: [
      /* @__PURE__ */ u3("div", { class: "formhead", children: [
        /* @__PURE__ */ u3(Who, { name: name || "?", n: Math.max(0, (plan.people || []).findIndex((q2) => q2.id === e3?.id)) + (e3 ? 0 : (plan.people || []).length), size: "lg" }),
        /* @__PURE__ */ u3("h2", { id: "finSheetTitle", children: e3 ? e3.name : "Add someone who gets paid" })
      ] }),
      /* @__PURE__ */ u3("div", { class: "formgrid", children: [
        /* @__PURE__ */ u3(Field, { label: "Name", children: /* @__PURE__ */ u3("input", { value: name, onInput: input(setName), required: true }) }),
        /* @__PURE__ */ u3(MoneyField, { label: "Take-home per check", value: net, set: setNet }),
        /* @__PURE__ */ u3(ScheduleFields, { every, setEvery, start, setStart, day2: day22, setDay2, startLabel: e3 ? "A payday" : "Next payday" }),
        /* @__PURE__ */ u3(AccountSelect, { label: "Lands in", value: account, set: setAccount, accounts, none: accounts.length ? void 0 : "Checking" }),
        /* @__PURE__ */ u3(MoneyField, { label: "Gross per check (optional)", value: gross, set: setGross })
      ] }),
      /* @__PURE__ */ u3("h3", { class: "formsub", children: [
        "Deductions ",
        /* @__PURE__ */ u3("span", { class: "muted", children: gross && taken ? `${money(num(gross) - taken)} left of gross` : "" })
      ] }),
      deds.map((d3, i3) => /* @__PURE__ */ u3("div", { class: "dedrow", children: [
        /* @__PURE__ */ u3("input", { "aria-label": "Deduction", value: d3.name, placeholder: "401(k)", onInput: (ev) => setDed(i3, "name", ev.target.value) }),
        /* @__PURE__ */ u3("span", { class: "moneyfield", children: [
          /* @__PURE__ */ u3("span", { "aria-hidden": "true", children: currencySign() }),
          /* @__PURE__ */ u3("input", { "aria-label": `${d3.name || "Deduction"} amount`, inputmode: "decimal", value: d3.amount, onInput: (ev) => setDed(i3, "amount", ev.target.value) })
        ] }),
        /* @__PURE__ */ u3("select", { "aria-label": `${d3.name || "Deduction"} goes into`, value: d3.account, onChange: (ev) => setDed(i3, "account", ev.target.value), children: [
          /* @__PURE__ */ u3("option", { value: "", children: "Nowhere (tax, insurance)" }),
          (plan.accounts || []).filter((a3) => a3.kind === "retirement" || a3.kind === "savings" || a3.kind === "investment").map((a3) => /* @__PURE__ */ u3("option", { value: a3.id, children: a3.name }, a3.id))
        ] }),
        /* @__PURE__ */ u3("button", { type: "button", class: "small", "aria-label": `Remove ${d3.name || "deduction"}`, onClick: () => setDeds(deds.filter((_3, j3) => j3 !== i3)), children: "Remove" })
      ] }, i3)),
      /* @__PURE__ */ u3("p", { children: /* @__PURE__ */ u3("button", { type: "button", class: "small addded", onClick: () => setDeds([...deds, { name: "", amount: "", account: "" }]), children: "Add a deduction" }) }),
      /* @__PURE__ */ u3(Actions3, { busy, exists: !!e3, remove, close: props.close, problem, touched })
    ] });
  }
  function FinanceSheet({ edit }) {
    return /* @__PURE__ */ u3(Sheet, { id: "finSheet", titleId: "finSheetTitle", children: [
      edit?.what === "payment" && /* @__PURE__ */ u3(PaymentForm, { ...edit }, "p" + edit.n),
      edit?.what === "account" && /* @__PURE__ */ u3(AccountForm, { ...edit }, "a" + edit.n),
      edit?.what === "person" && /* @__PURE__ */ u3(PersonForm, { ...edit }, "e" + edit.n),
      !edit && /* @__PURE__ */ u3("h2", { id: "finSheetTitle", children: "Finances" })
    ] });
  }
  function mountFinanceSheet(el, edit) {
    R(/* @__PURE__ */ u3(FinanceSheet, { edit }), el);
  }

  // web/src/finances/ui/Amount.tsx
  var toneClass = (tone, n2) => tone === "auto" ? n2 < -5e-3 ? " fx-out" : n2 > 5e-3 ? " fx-in" : "" : tone ? " fx-" + tone : "";
  function Amount({ value, form: form2 = "small", sign, tone }) {
    const cls = "fx-amount" + toneClass(tone, value);
    if (form2 === "compact") return /* @__PURE__ */ u3("span", { class: cls, children: compact(value) });
    if (form2 === "whole") return /* @__PURE__ */ u3("span", { class: cls, children: [
      sign && value > 0.5 ? "+" : "",
      whole(value)
    ] });
    if (form2 === "full") return /* @__PURE__ */ u3("span", { class: cls, children: sign ? signed(value) : money(value) });
    const [d3, c3] = split(Math.abs(value));
    return /* @__PURE__ */ u3("span", { class: cls, children: [
      value < -5e-3 ? "−" : sign && value > 5e-3 ? "+" : "",
      d3,
      /* @__PURE__ */ u3("small", { children: c3 })
    ] });
  }
  function Delta({ value, base, look: look2 = "badge", label, downIsGood, shareOnly }) {
    const flat = Math.abs(value) < 5e-3;
    const good = flat ? null : value > 0 !== !!downIsGood;
    const tone = good === null ? "muted" : good ? "in" : "out";
    const pct = base && Math.abs(base) > 5e-3 ? `${value < 0 ? "−" : "+"}${Math.abs(value / Math.abs(base) * 100).toFixed(1)}%` : "";
    if (look2 === "badge") return /* @__PURE__ */ u3("span", { class: "fx-badge fx-" + tone, children: shareOnly ? pct : /* @__PURE__ */ u3(S, { children: [
      signed(value),
      pct && /* @__PURE__ */ u3(S, { children: [
        " ",
        pct
      ] })
    ] }) });
    return /* @__PURE__ */ u3("span", { class: "fx-delta", children: [
      /* @__PURE__ */ u3("span", { class: "fx-" + tone, children: flat ? "No change" : /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("span", { "aria-hidden": "true", children: value < 0 ? "↓ " : "↑ " }),
        signed(value),
        pct && ` (${pct})`
      ] }) }),
      label && /* @__PURE__ */ u3("span", { class: "fx-sub", children: [
        " ",
        label
      ] })
    ] });
  }
  function Stat({ value, caption, aside, size = "md" }) {
    return /* @__PURE__ */ u3("div", { class: "fx-stat " + size, children: [
      /* @__PURE__ */ u3("div", { class: "fx-statmain", children: [
        /* @__PURE__ */ u3("div", { class: "fx-figure", children: value }),
        aside && /* @__PURE__ */ u3("div", { class: "fx-aside", children: aside })
      ] }),
      caption && /* @__PURE__ */ u3("div", { class: "fx-caption", children: caption })
    ] });
  }
  function Tiles2({ items }) {
    return /* @__PURE__ */ u3("div", { class: "fx-tiles", children: items.map((t3) => /* @__PURE__ */ u3("div", { class: "fx-tile", children: [
      /* @__PURE__ */ u3("div", { class: "fx-caption", children: t3.label }),
      /* @__PURE__ */ u3("div", { class: "fx-tilevalue" + toneClass(t3.tone, 0), children: t3.value })
    ] }, t3.label)) });
  }

  // web/src/finances/ui/Legend.tsx
  var hue = (h3) => typeof h3 === "number" ? `fx-h${h3}` : `fx-h-${h3}`;
  function Dot({ color, shape = "round" }) {
    return /* @__PURE__ */ u3("span", { class: `fx-dot ${shape} ${hue(color)}`, "aria-hidden": "true" });
  }
  function SplitBar({ parts, label, size = "md" }) {
    const total = parts.reduce((t3, p3) => t3 + Math.max(0, p3.value), 0);
    const said = parts.filter((p3) => p3.value > 0).map((p3) => `${p3.label} ${Math.round(p3.value / (total || 1) * 100)}%`).join(", ");
    return /* @__PURE__ */ u3("div", { class: "fx-split " + size, role: "img", "aria-label": `${label}: ${said}`, children: parts.filter((p3) => p3.value > 0).map((p3) => /* @__PURE__ */ u3("span", { class: hue(p3.color), style: { flexGrow: p3.value } }, p3.label)) });
  }
  function Legend({ items, layout = "list" }) {
    return /* @__PURE__ */ u3("ul", { class: "fx-legend " + layout, children: items.map((it, i3) => /* @__PURE__ */ u3("li", { children: [
      /* @__PURE__ */ u3(Dot, { color: it.color, shape: it.shape }),
      /* @__PURE__ */ u3("span", { class: "fx-legendlabel", children: it.label }),
      it.note !== void 0 && /* @__PURE__ */ u3("span", { class: "fx-sub", children: it.note }),
      it.value !== void 0 && /* @__PURE__ */ u3("span", { class: "fx-legendvalue", children: it.value })
    ] }, i3)) });
  }

  // web/src/finances/ui/Widget.tsx
  function Widget({ title, id: id2, actions, span = 1, kind, children }) {
    return /* @__PURE__ */ u3(Card, { id: id2, kind: "fx-widget" + (span === 1 ? "" : span === 2 ? " span2" : " spanall") + (kind ? " " + kind : ""), children: [
      /* @__PURE__ */ u3(CardHead, { title, children: actions ? /* @__PURE__ */ u3("span", { class: "fx-actions", children: actions }) : void 0 }),
      children
    ] });
  }
  var icons3 = {
    open: "M7 17 17 7M8 7h9v9",
    info: "M12 16v-4M12 8h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"
  };
  function IconButton({ icon, label, onClick, pressed }) {
    return /* @__PURE__ */ u3("button", { type: "button", class: "fx-icon", "aria-label": label, title: label, "aria-pressed": pressed, onClick, children: /* @__PURE__ */ u3("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ u3("path", { d: icons3[icon] }) }) });
  }

  // web/src/finances/model.ts
  function month(v3, L2) {
    const people = v3.plan.people || [];
    const payments = v3.plan.payments || [];
    const income = people.reduce((t3, e3) => t3 + e3.net * perMonth(e3.schedule), 0);
    const kept = (id2) => saving(L2.account[id2 || ""]?.kind);
    const onCard = (x2) => L2.account[x2.from || ""]?.kind === "card";
    const fromPay = payments.filter((x2) => (!x2.from || x2.from === v3.checking || onCard(x2)) && !(x2.to && x2.to === v3.checking));
    const each = (x2) => x2.amount * perMonth(x2.schedule, people);
    const spentList = fromPay.filter((x2) => !kept(x2.to));
    const spent = spentList.reduce((t3, x2) => t3 + each(x2), 0);
    const saved = fromPay.filter((x2) => kept(x2.to)).reduce((t3, x2) => t3 + each(x2), 0);
    const viaPay = people.reduce((t3, e3) => t3 + (e3.deductions || []).filter((d3) => kept(d3.account)).reduce((u4, d3) => u4 + d3.amount, 0) * perMonth(e3.schedule), 0);
    const kinds = {};
    for (const x2 of spentList) kinds[x2.kind || "other"] = (kinds[x2.kind || "other"] || 0) + each(x2);
    const byKind = Object.entries(kinds).map(([kind, amount]) => ({ kind, amount })).filter((k3) => k3.amount > 5e-3).sort((a3, b2) => b2.amount - a3.amount);
    return { in: income, spent, saved, left: income - spent - saved, viaPay, byKind };
  }
  var kindName = (kind) => ({ home: "Home", utilities: "Utilities", car: "Car", subscriptions: "Subscriptions", loans: "Loans", cards: "Cards", spending: "Spending", savings: "Saving", other: "Other" })[kind] || kind;
  var todayOf = (v3, a3) => v3.start?.[a3.id] ?? (a3.kind === "card" ? a3.balance + (a3.pending || 0) : a3.balance);
  var worthOf = (v3, a3) => owed(a3.kind) ? -todayOf(v3, a3) : todayOf(v3, a3);
  var groups = [
    { key: "cash", name: "Cash", kinds: ["checking", "savings"], color: 1 },
    { key: "cards", name: "Credit cards", kinds: ["card"], color: 8 },
    { key: "investments", name: "Investments", kinds: ["investment"], color: 2 },
    { key: "retirement", name: "Retirement", kinds: ["retirement"], color: 3 },
    { key: "property", name: "Home and car", kinds: ["home", "car"], color: 4 },
    { key: "collectibles", name: "Collectibles", kinds: ["collectible"], color: 5 },
    { key: "other", name: "Other", kinds: ["other"], color: 6 },
    { key: "loans", name: "Loans", kinds: ["loan"], color: 7 }
  ];
  function grouped(v3) {
    const accounts = v3.plan.accounts || [];
    return groups.map((g2) => {
      const list = accounts.filter((a3) => g2.kinds.includes(a3.kind));
      return { key: g2.key, name: g2.name, color: g2.color, accounts: list, total: list.reduce((t3, a3) => t3 + worthOf(v3, a3), 0) };
    }).filter((g2) => g2.accounts.length);
  }
  var netWorth = (v3) => (v3.plan.accounts || []).reduce((t3, a3) => t3 + worthOf(v3, a3), 0);
  function balanceOn(v3, a3, day3) {
    const h3 = a3.history || [];
    let at;
    for (const p3 of h3) if (p3.date <= day3) at = p3.amount;
    return at ?? h3[0]?.amount ?? todayOf(v3, a3);
  }
  var worthOn = (v3, a3, day3) => owed(a3.kind) ? -balanceOn(v3, a3, day3) : balanceOn(v3, a3, day3);
  var firstKept = (v3) => (v3.plan.accounts || []).flatMap((a3) => (a3.history || []).map((p3) => p3.date)).sort()[0] || v3.today;
  function worthByMonth(v3, back = 3, ahead2 = 3) {
    const accounts = v3.plan.accounts || [];
    const groupOf = (kind) => groups.find((g2) => g2.kinds.includes(kind))?.key || "other";
    const against = new Set(accounts.filter((a3) => groupOf(a3.kind) === "property" && a3.loan).map((a3) => a3.loan));
    const split2 = (value) => {
      const owned = {};
      let owes = 0, secured = 0;
      for (const a3 of accounts) {
        const n2 = value(a3);
        if (owed(a3.kind)) {
          owes += n2;
          if (against.has(a3.id)) secured += n2;
        } else owned[groupOf(a3.kind)] = (owned[groupOf(a3.kind)] || 0) + n2;
      }
      const net = Object.values(owned).reduce((t3, n2) => t3 + n2, 0) - owes;
      return { owned, owes, secured, net };
    };
    const out = [];
    const today = parseDay(v3.today);
    for (let i3 = back; i3 >= 1; i3--) {
      const end = isoDay(new Date(today.getFullYear(), today.getMonth() - i3 + 1, 0));
      out.push({ date: end, ahead: false, ...split2((a3) => balanceOn(v3, a3, end)) });
    }
    out.push({ date: v3.today, ahead: false, ...split2((a3) => todayOf(v3, a3)) });
    for (let i3 = 1; i3 <= ahead2; i3++) {
      const end = isoDay(new Date(today.getFullYear(), today.getMonth() + i3 + 1, 0));
      if (!v3.periods.some((q2) => q2.last >= end)) break;
      const p3 = [...v3.periods].reverse().find((q2) => q2.last <= end && q2.accounts);
      if (!p3) break;
      out.push({ date: end, ahead: true, ...split2((a3) => p3.accounts[a3.id] ?? todayOf(v3, a3)) });
    }
    return out;
  }
  var checkingDays = (v3, n2 = 31) => (v3.days || []).slice(0, n2);
  var surplus = (p3) => p3.in - p3.out;

  // web/src/finances/Lists.tsx
  var currencies = ["USD", "CAD", "EUR", "GBP", "AUD", "NZD", "CHF", "SEK", "NOK", "DKK", "JPY", "MXN", "INR", "ZAR"];
  var calendars = [["us", "US bank holidays"], ["uk", "UK bank holidays (England and Wales)"], ["none", "Weekends only"]];
  function Settings2({ v: v3, save: save2 }) {
    const [busy, setBusy] = d2(false);
    const currency = v3.plan.currency || "USD", holidays = v3.plan.holidays || "us";
    const keep2 = async (s3) => {
      setBusy(true);
      await save2(s3);
      setBusy(false);
    };
    return /* @__PURE__ */ u3(Widget, { title: "Paydays and money", span: "all", children: /* @__PURE__ */ u3("div", { class: "finsettings", children: [
      /* @__PURE__ */ u3("label", { class: "field", children: [
        "A payday on a weekend or ",
        /* @__PURE__ */ u3("select", { disabled: busy, value: holidays, onChange: (e3) => keep2({ currency, holidays: e3.target.value }), children: calendars.map(([k3, t3]) => /* @__PURE__ */ u3("option", { value: k3, children: t3 }, k3)) }),
        " comes the business day before"
      ] }),
      /* @__PURE__ */ u3("label", { class: "field", children: [
        "Amounts in ",
        /* @__PURE__ */ u3("select", { disabled: busy, value: currency, onChange: (e3) => keep2({ currency: e3.target.value, holidays }), children: (currencies.includes(currency) ? currencies : [currency, ...currencies]).map((c3) => /* @__PURE__ */ u3("option", { value: c3, children: c3 }, c3)) })
      ] })
    ] }) });
  }
  var groups2 = {
    all: () => true,
    bills: (k3) => ["home", "utilities", "car", "loans", "other", ""].includes(k3 || ""),
    cards: (k3) => k3 === "cards",
    subscriptions: (k3) => k3 === "subscriptions",
    spending: (k3) => k3 === "spending",
    saving: (k3) => k3 === "savings"
  };
  function after(day3, today = todayISO()) {
    const d3 = daysBetween(today, day3);
    const months = Math.round(d3 / 30.4);
    return months >= 2 ? `in ${months} months` : d3 >= 14 ? `in ${Math.round(d3 / 7)} weeks` : `in ${plural2(d3, "day")}`;
  }
  function nextOf(v3) {
    const out = {};
    for (const p3 of v3.periods) for (const r3 of p3.rows) if (!out[r3.payment]) out[r3.payment] = { date: r3.date, period: p3 };
    return out;
  }
  function Recurring({ v: v3, L: L2, edit }) {
    const [filter, setFilter] = d2("all");
    const payments = v3.plan.payments || [];
    const next = nextOf(v3);
    const m3 = month(v3, L2);
    const share2 = (n2) => m3.in ? `${Math.round(n2 / m3.in * 100)}% of pay` : "";
    const onCard = (x2) => L2.account[x2.from || ""]?.kind === "card";
    const list = payments.filter((x2) => groups2[filter](x2.kind)).sort((a3, b2) => (next[a3.id]?.date || "9").localeCompare(next[b2.id]?.date || "9"));
    const count = (g2) => payments.filter((x2) => groups2[g2](x2.kind)).length;
    return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3("div", { class: "fx-board", children: [
      /* @__PURE__ */ u3(Widget, { title: "A typical month", span: "all", kind: "fx-monthsum", children: [
        /* @__PURE__ */ u3("div", { class: "fx-stats", children: [
          /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: m3.in, form: "whole", tone: "in" }), caption: `In · ${(v3.plan.people || []).length === 1 ? "1 paycheck" : `${(v3.plan.people || []).length} paychecks`}` }),
          /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: m3.spent, form: "whole", tone: "out" }), caption: `Spent · ${share2(m3.spent)}` }),
          /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: m3.saved, form: "whole", tone: "save" }), caption: /* @__PURE__ */ u3(S, { children: [
            "Saved · ",
            share2(m3.saved),
            !!m3.viaPay && /* @__PURE__ */ u3("span", { class: "fx-capnote", children: [
              "plus ",
              whole(m3.viaPay),
              " before pay"
            ] })
          ] }) }),
          /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: m3.left, form: "whole", tone: m3.left < 0 ? "out" : "" }), caption: "Left over" })
        ] }),
        /* @__PURE__ */ u3(SplitBar, { label: "A typical month's pay", parts: [{ label: "Spent", value: m3.spent, color: "out" }, { label: "Saved", value: m3.saved, color: "save" }, { label: "Left", value: Math.max(0, m3.left), color: "in" }] })
      ] }),
      /* @__PURE__ */ u3(
        Widget,
        {
          title: "Payments",
          span: "all",
          kind: "fx-payments",
          actions: /* @__PURE__ */ u3(Segmented, { label: "Show", value: filter, pick: setFilter, options: [["all", `All ${count("all")}`], ["bills", `Bills ${count("bills")}`], ["cards", `Cards ${count("cards")}`], ["subscriptions", `Subscriptions ${count("subscriptions")}`], ["spending", `Spending ${count("spending")}`], ["saving", `Saving ${count("saving")}`]] }),
          children: /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: [
            list.map((x2) => {
              const n2 = next[x2.id];
              const later2 = n2 ? "" : v3.next?.[x2.id] || "";
              const from = n2 && (x2.to && x2.to === v3.checking ? "into checking" : onCard(x2) ? "on " + L2.account[x2.from].name : n2.period.now ? "from the current balance" : `${n2.period.pay.people.map((id2) => L2.person[id2]?.name).join(" and ")}'s ${dayShort(n2.period.pay.date)} check`);
              const into = x2.to ? " → " + (L2.account[x2.to]?.name || x2.to) : "";
              return /* @__PURE__ */ u3(
                Row,
                {
                  lead: /* @__PURE__ */ u3(Mark2, { brand: brandOf(x2.institution, x2.name), kind: x2.kind, name: x2.name }),
                  title: x2.name,
                  sub: scheduleText(x2.schedule, L2) + into + (x2.card ? " · the card's balance" : x2.estimate ? " · about" : ""),
                  end: /* @__PURE__ */ u3("span", { class: "fx-next", children: n2 ? /* @__PURE__ */ u3(S, { children: [
                    /* @__PURE__ */ u3("span", { children: dayLong(n2.date) }),
                    /* @__PURE__ */ u3("span", { class: "fx-sub", children: from })
                  ] }) : later2 ? /* @__PURE__ */ u3(S, { children: [
                    /* @__PURE__ */ u3("span", { children: [
                      dayLong(later2),
                      later2.slice(0, 4) !== v3.today.slice(0, 4) ? ", " + later2.slice(0, 4) : ""
                    ] }),
                    /* @__PURE__ */ u3("span", { class: "fx-sub", children: after(later2, v3.today) })
                  ] }) : /* @__PURE__ */ u3("span", { class: "fx-sub", children: "Nothing ahead" }) }),
                  when: /* @__PURE__ */ u3(Amount, { value: x2.card && n2?.period ? n2.period.rows.find((r3) => r3.payment === x2.id)?.amount ?? x2.amount : x2.amount, form: "full" }),
                  whenPlain: true,
                  onOpen: edit ? () => edit("payment", x2.id) : void 0,
                  openLabel: "edit"
                },
                x2.id
              );
            }),
            !list.length && /* @__PURE__ */ u3("li", { children: /* @__PURE__ */ u3(Empty, { children: payments.length ? "None of this kind." : "No payments yet: the mortgage, the car, subscriptions, a card's balance." }) })
          ] })
        }
      )
    ] }) });
  }
  function Pay({ v: v3, L: L2, edit, saveSettings }) {
    const people = v3.plan.people || [];
    const paydays = (v3.paydays || []).slice(0, 10);
    const into = (id2) => {
      const to = L2.person[id2]?.account;
      return to && to !== v3.checking ? L2.account[to]?.name || to : "";
    };
    return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3("div", { class: "fx-board", children: [
      people.map((e3) => {
        const ded = e3.deductions || [];
        const taken = ded.reduce((t3, d3) => t3 + d3.amount, 0);
        return /* @__PURE__ */ u3(
          Widget,
          {
            kind: "fx-person",
            title: /* @__PURE__ */ u3("span", { class: "fx-who", children: [
              /* @__PURE__ */ u3(Who, { name: e3.name, n: L2.order[e3.id] ?? 0, size: "lg" }),
              /* @__PURE__ */ u3("span", { children: [
                e3.name,
                /* @__PURE__ */ u3("span", { class: "fx-sub", children: [
                  scheduleText(e3.schedule),
                  " · into ",
                  L2.account[e3.account || v3.checking]?.name || "checking"
                ] })
              ] })
            ] }),
            actions: edit && /* @__PURE__ */ u3(IconButton, { icon: "edit", label: `Edit ${e3.name}'s pay`, onClick: () => edit("person", e3.id) }),
            children: [
              /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: e3.net }), caption: "Take-home, each paycheck" }),
              !!e3.gross && (() => {
                const parts = [{ label: "Take-home", value: e3.net, color: "in" }, ...ded.map((d3) => ({ label: d3.name, value: d3.amount, color: d3.account ? "save" : "track" })), ...e3.gross - e3.net - taken > 0.5 ? [{ label: "Taxes and the rest", value: e3.gross - e3.net - taken, color: "muted" }] : []];
                return /* @__PURE__ */ u3(S, { children: [
                  /* @__PURE__ */ u3(SplitBar, { size: "sm", label: `${e3.name}'s pay`, parts }),
                  /* @__PURE__ */ u3(Legend, { layout: "inline", items: parts.map((p3) => ({ label: p3.label, color: p3.color })) })
                ] });
              })(),
              (!!e3.gross || !!ded.length) && /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: [
                !!e3.gross && /* @__PURE__ */ u3(Row, { title: "Gross", when: /* @__PURE__ */ u3(Amount, { value: e3.gross, form: "full" }), whenPlain: true }),
                ded.map((d3, i3) => /* @__PURE__ */ u3(Row, { title: d3.name, sub: d3.account ? "into " + (L2.account[d3.account]?.name || d3.account) : "", when: /* @__PURE__ */ u3(Amount, { value: -d3.amount, form: "full" }), whenPlain: true }, i3))
              ] })
            ]
          },
          e3.id
        );
      }),
      edit && /* @__PURE__ */ u3("button", { type: "button", class: "finadd", onClick: () => edit("person"), children: [
        /* @__PURE__ */ u3("span", { "aria-hidden": "true", children: "+" }),
        "Add someone who gets paid"
      ] }),
      !people.length && !edit && /* @__PURE__ */ u3(Card, { children: /* @__PURE__ */ u3(Empty, { children: "No paychecks typed in yet." }) }),
      !!paydays.length && /* @__PURE__ */ u3(Widget, { title: "Next paychecks", span: "all", kind: "fx-paydays", children: /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: paydays.map((p3) => /* @__PURE__ */ u3(
        Row,
        {
          lead: /* @__PURE__ */ u3("span", { class: "fwhos", children: p3.people.map((id2) => /* @__PURE__ */ u3(Who, { name: L2.person[id2]?.name, n: L2.order[id2] ?? 0 }, id2)) }),
          title: dayLong(p3.date),
          sub: p3.people.map((id2) => L2.person[id2]?.name + (into(id2) ? ` (into ${into(id2)})` : "")).join(" and "),
          end: (p3.moved || []).map((mv) => /* @__PURE__ */ u3("span", { class: "fx-badge fx-muted", children: [
            mv.why.charAt(0).toUpperCase() + mv.why.slice(1),
            ", from ",
            dayShort(mv.from)
          ] }, mv.person)),
          when: /* @__PURE__ */ u3(Amount, { value: p3.total, sign: true, tone: "in", form: "full" }),
          whenPlain: true
        },
        p3.date
      )) }) }),
      saveSettings && /* @__PURE__ */ u3(Settings2, { v: v3, save: saveSettings })
    ] }) });
  }

  // web/src/finances/ui/charts.tsx
  function ticks(lo, hi, count = 4) {
    const span = Math.max(hi - lo, 1);
    const raw = span / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step2 = [1, 2, 2.5, 5, 10].map((m3) => m3 * mag).find((s3) => s3 >= raw) || 10 * mag;
    const bottom = Math.floor(lo / step2) * step2, top = Math.ceil(hi / step2) * step2;
    const out = [];
    for (let t3 = bottom; t3 <= top + step2 / 1e6; t3 += step2) out.push(Math.round(t3 * 100) / 100);
    return { ticks: out, top, bottom };
  }
  var tipSide = (x2) => x2 < 60 ? { left: `calc(${x2}% + 14px)` } : { right: `calc(${100 - x2}% + 14px)` };
  function Axis({ marks: marks2, y: y3, format: format2 }) {
    return /* @__PURE__ */ u3("div", { class: "fx-axis", "aria-hidden": "true", children: marks2.map((t3) => /* @__PURE__ */ u3("span", { class: t3 === 0 ? "zero" : "", style: { top: `${y3(t3)}px` }, children: format2(t3) }, t3)) });
  }
  function AreaChart({ values, xLabels, marks: marks2 = [], threshold, aheadFrom, band, height = 200, format: format2, tip, label, zero = true, axis: showAxis = true, fill }) {
    const [at, setAt] = d2(-1);
    const n2 = values.length;
    const plot = A2(null);
    const [room, setRoom] = d2(0);
    _2(() => {
      if (!fill || !plot.current) return;
      const watch2 = new ResizeObserver(([e3]) => setRoom(Math.round(e3.contentRect.height)));
      watch2.observe(plot.current);
      return () => watch2.disconnect();
    }, [fill, n2 >= 2]);
    if (n2 < 2) return null;
    const tall = fill ? Math.max(height, room) : height;
    const lo = zero ? Math.min(0, ...values, threshold ?? 0) : Math.min(...values), hi = zero ? Math.max(...values, threshold ?? 0, 1) : Math.max(...values);
    const axis = zero ? ticks(lo, hi * 1.08) : ticks(lo - (hi - lo) * 0.1, hi + (hi - lo) * 0.1);
    const y3 = (v3) => (axis.top - v3) / (axis.top - axis.bottom || 1) * tall;
    const x2 = (i3) => i3 / (n2 - 1) * 1e3;
    const pct = (i3) => i3 / (n2 - 1) * 100;
    const cut = aheadFrom === void 0 ? n2 - 1 : Math.min(n2 - 1, aheadFrom);
    const path = (from, to) => values.slice(from, to + 1).map((v3, k3) => `${k3 ? "L" : "M"}${x2(from + k3).toFixed(1)} ${y3(v3).toFixed(1)}`).join(" ");
    const solid = path(0, cut);
    const move = (e3) => {
      const r3 = e3.currentTarget.getBoundingClientRect();
      setAt(Math.max(0, Math.min(n2 - 1, Math.round((e3.clientX - r3.left) / r3.width * (n2 - 1)))));
    };
    return /* @__PURE__ */ u3("figure", { class: "fx-chart fx-area" + (fill ? " fill" : ""), "aria-label": label, children: [
      /* @__PURE__ */ u3("div", { class: "fx-plotrow", children: [
        showAxis && /* @__PURE__ */ u3(Axis, { marks: axis.ticks, y: y3, format: format2 }),
        /* @__PURE__ */ u3("div", { ref: plot, class: "fx-plot", style: fill ? { minHeight: `${height}px` } : { height: `${height}px` }, onPointerMove: move, onPointerLeave: () => setAt(-1), children: [
          showAxis && axis.ticks.map((t3) => /* @__PURE__ */ u3("span", { class: "fx-grid" + (t3 === 0 ? " zero" : ""), style: { top: `${y3(t3)}px` } }, t3)),
          band && /* @__PURE__ */ u3("span", { class: "fx-band", style: { left: `${pct(band.from)}%`, width: `${pct(band.to) - pct(band.from)}%` } }),
          threshold !== void 0 && /* @__PURE__ */ u3("span", { class: "fx-threshold", style: { top: `${y3(threshold)}px` } }),
          /* @__PURE__ */ u3("svg", { viewBox: `0 0 1000 ${tall}`, preserveAspectRatio: "none", "aria-hidden": "true", children: [
            /* @__PURE__ */ u3("path", { class: "fx-areafill", d: `${solid} L${x2(cut).toFixed(1)} ${tall} L0 ${tall} Z` }),
            /* @__PURE__ */ u3("path", { class: "fx-line", d: solid, "vector-effect": "non-scaling-stroke" }),
            cut < n2 - 1 && /* @__PURE__ */ u3("path", { class: "fx-line ahead", d: path(cut, n2 - 1), "vector-effect": "non-scaling-stroke" })
          ] }),
          marks2.map((m3, k3) => /* @__PURE__ */ u3("span", { class: "fx-mark fx-h-" + m3.tone, style: { left: `${pct(m3.i)}%`, top: `${y3(values[m3.i])}px` } }, k3)),
          at >= 0 && /* @__PURE__ */ u3(S, { children: [
            /* @__PURE__ */ u3("span", { class: "fx-cross", style: { left: `${pct(at)}%` } }),
            /* @__PURE__ */ u3("span", { class: "fx-pin", style: { left: `${pct(at)}%`, top: `${y3(values[at])}px` } }),
            tip && /* @__PURE__ */ u3("div", { class: "fx-tip", style: tipSide(pct(at)), children: tip(at) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ u3("div", { class: "fx-xlabels" + (showAxis ? "" : " bare"), "aria-hidden": "true", children: xLabels.map((l3) => /* @__PURE__ */ u3("span", { style: { left: `${pct(l3.i)}%` }, children: l3.label }, l3.i)) })
    ] });
  }
  function Bars2({ bars, height = 96, picked, pick, say, label }) {
    const lo = Math.min(0, ...bars.map((b2) => b2.value)), hi = Math.max(0, ...bars.map((b2) => b2.value));
    const span = hi - lo || 1;
    const zero = hi / span * height;
    const size = (v3) => Math.max(2, Math.abs(v3) / span * height);
    return /* @__PURE__ */ u3("figure", { class: "fx-chart fx-bars" + (pick ? " pick" : ""), "aria-label": label, children: [
      /* @__PURE__ */ u3("div", { class: "fx-barplot", style: { height: `${height}px`, gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }, children: [
        /* @__PURE__ */ u3("span", { class: "fx-grid zero", style: { top: `${zero}px` } }),
        bars.map((b2, i3) => {
          const style = { height: `${size(b2.value)}px`, top: `${b2.value >= 0 ? zero - size(b2.value) : zero}px` };
          const cls = `fx-bar ${hue(b2.color ?? (b2.value < 0 ? "out" : "in"))}${b2.value < 0 ? " down" : ""}${b2.ahead ? " ahead" : ""}${i3 === picked ? " on" : ""}`;
          return pick ? /* @__PURE__ */ u3("button", { type: "button", class: "fx-barcol", "aria-pressed": i3 === picked, "aria-label": say(b2), onClick: () => pick(i3), children: /* @__PURE__ */ u3("span", { class: cls, style }) }, i3) : /* @__PURE__ */ u3("span", { class: "fx-barcol", role: "img", "aria-label": say(b2), children: /* @__PURE__ */ u3("span", { class: cls, style }) }, i3);
        })
      ] }),
      /* @__PURE__ */ u3("div", { class: "fx-barlabels", "aria-hidden": "true", style: { gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }, children: bars.map((b2, i3) => /* @__PURE__ */ u3("span", { class: i3 === picked ? "on" : "", children: [
        b2.label,
        b2.sub && /* @__PURE__ */ u3("small", { children: b2.sub })
      ] }, i3)) })
    ] });
  }
  function StackedBars({ columns, height = 260, format: format2, tip, label }) {
    const last = columns.map((c3) => !c3.ahead).lastIndexOf(true);
    const [at, setAt] = d2(-1);
    const shown5 = at >= 0 ? at : last;
    const top = Math.max(...columns.map((c3) => c3.up.reduce((t3, p3) => t3 + p3.value, 0)), ...columns.map((c3) => c3.line), 1);
    const bottom = Math.min(0, ...columns.map((c3) => -c3.down.reduce((t3, p3) => t3 + p3.value, 0)), ...columns.map((c3) => c3.line));
    const axis = ticks(bottom, top, 4);
    const pad = (top - bottom) * 0.04;
    const ceil = Math.min(axis.top, top + pad), floor = bottom < 0 ? Math.max(axis.bottom, bottom - pad) : 0;
    const marks2 = axis.ticks.filter((t3) => t3 <= ceil + 1e-6 && t3 >= floor - 1e-6);
    const y3 = (v3) => (ceil - v3) / (ceil - floor || 1) * height;
    const n2 = columns.length;
    const cx = (i3) => (i3 + 0.5) / n2 * 1e3;
    const line = (from, to) => columns.slice(from, to + 1).map((c3, k3) => `${cx(from + k3).toFixed(1)},${y3(c3.line).toFixed(1)}`).join(" ");
    return /* @__PURE__ */ u3("figure", { class: "fx-chart fx-stacked", "aria-label": label, children: [
      /* @__PURE__ */ u3("div", { class: "fx-plotrow", children: [
        /* @__PURE__ */ u3(Axis, { marks: marks2, y: y3, format: format2 }),
        /* @__PURE__ */ u3("div", { class: "fx-plot", style: { height: `${height}px` }, onPointerLeave: () => setAt(-1), children: [
          marks2.map((t3) => /* @__PURE__ */ u3("span", { class: "fx-grid" + (t3 === 0 ? " zero" : ""), style: { top: `${y3(t3)}px` } }, t3)),
          floor < 0 && /* @__PURE__ */ u3("span", { class: "fx-below", style: { top: `${y3(0)}px` } }),
          columns.map((c3, i3) => {
            let up = 0, down = 0;
            return /* @__PURE__ */ u3("div", { class: "fx-stackcol" + (c3.ahead ? " ahead" : "") + (i3 === shown5 ? " on" : ""), style: { left: `${i3 / n2 * 100}%`, width: `${100 / n2}%` }, onPointerEnter: () => setAt(i3), children: [
              c3.up.map((p3, k3) => {
                const t3 = y3(up + p3.value), h3 = y3(up) - t3;
                up += p3.value;
                return /* @__PURE__ */ u3("span", { class: "fx-seg " + hue(p3.color) + (k3 === c3.up.length - 1 ? " cap" : ""), style: { top: `${t3}px`, height: `${Math.max(h3, p3.value > 0 ? 1 : 0)}px` } }, "u" + k3);
              }),
              c3.down.map((p3, k3) => {
                const t3 = y3(-down), h3 = y3(-down - p3.value) - t3;
                down += p3.value;
                return /* @__PURE__ */ u3("span", { class: "fx-seg " + hue(p3.color) + (k3 === c3.down.length - 1 ? " foot" : ""), style: { top: `${t3}px`, height: `${Math.max(h3, p3.value > 0 ? 1 : 0)}px` } }, "d" + k3);
              })
            ] }, i3);
          }),
          /* @__PURE__ */ u3("svg", { viewBox: `0 0 1000 ${height}`, preserveAspectRatio: "none", "aria-hidden": "true", children: [
            /* @__PURE__ */ u3("polyline", { class: "fx-netline", points: line(0, last), "vector-effect": "non-scaling-stroke" }),
            last < n2 - 1 && /* @__PURE__ */ u3("polyline", { class: "fx-netline ahead", points: line(last, n2 - 1), "vector-effect": "non-scaling-stroke" })
          ] }),
          columns.map((c3, i3) => /* @__PURE__ */ u3("span", { class: "fx-netdot" + (i3 === shown5 ? " on" : ""), style: { left: `${(i3 + 0.5) / n2 * 100}%`, top: `${y3(c3.line)}px` } }, i3)),
          at >= 0 && /* @__PURE__ */ u3("div", { class: "fx-tip wide", style: tipSide((at + 0.5) / n2 * 100), children: tip(at) })
        ] })
      ] }),
      /* @__PURE__ */ u3("div", { class: "fx-barlabels", "aria-hidden": "true", style: { gridTemplateColumns: `repeat(${n2}, minmax(0, 1fr))` }, children: columns.map((c3, i3) => /* @__PURE__ */ u3("span", { class: i3 === shown5 ? "on" : "", children: c3.label }, i3)) })
    ] });
  }
  function Donut({ slices, center, size = 150, label }) {
    const total = slices.reduce((t3, s3) => t3 + Math.max(0, s3.value), 0) || 1;
    const r3 = 56, c3 = 2 * Math.PI * r3, gap = slices.length > 1 ? 2 : 0;
    let run = 0;
    const said = slices.map((s3) => `${s3.label} ${Math.round(s3.value / total * 100)}%`).join(", ");
    return /* @__PURE__ */ u3("div", { class: "fx-donut", style: { width: `${size}px`, height: `${size}px` }, children: [
      /* @__PURE__ */ u3("svg", { viewBox: "0 0 150 150", role: "img", "aria-label": `${label}: ${said}`, children: slices.map((s3) => {
        const len = Math.max(0, s3.value) / total * c3;
        const el = /* @__PURE__ */ u3("circle", { class: "fx-slice " + hue(s3.color), cx: "75", cy: "75", r: r3, "stroke-dasharray": `${Math.max(len - gap, 0.5).toFixed(2)} ${c3.toFixed(2)}`, "stroke-dashoffset": (-run).toFixed(2) }, s3.label);
        run += len;
        return el;
      }) }),
      /* @__PURE__ */ u3("div", { class: "fx-donutcenter", children: center })
    ] });
  }

  // web/src/finances/widgets/Checking.tsx
  var bigBill = 300;
  function CheckingWidget({ v: v3, L: L2, sel: sel2 }) {
    const [span, setSpan] = d2("31");
    const days = checkingDays(v3, Number(span));
    if (days.length < 2) return null;
    const cushion = v3.plan.cushion || 0;
    const values = days.map((d3) => d3.balance);
    const low = values.indexOf(Math.min(...values));
    const now = L2.account[v3.checking] ? todayOf(v3, L2.account[v3.checking]) : values[0];
    const marks2 = days.flatMap((d3, i3) => (d3.events || []).filter((e3) => e3.people || Math.abs(e3.amount) >= bigBill).map((e3) => ({ i: i3, tone: e3.amount > 0 ? "in" : "out" })));
    const p3 = v3.periods[sel2];
    const from = days.findIndex((d3) => d3.date >= (p3?.start || "")), to = days.map((d3) => d3.date <= (p3?.last || "")).lastIndexOf(true);
    const step2 = Math.max(1, Math.round(days.length / 4.5));
    const xLabels = days.map((d3, i3) => ({ i: i3, label: dayShort(d3.date) })).filter((_3, i3) => i3 % step2 === 0 || i3 === days.length - 1).filter((l3, k3, all) => k3 === all.length - 1 || days.length - 1 - l3.i > step2 / 2);
    const lead = (e3) => {
      if (e3.people?.length) return /* @__PURE__ */ u3(Who, { name: L2.person[e3.people[0]]?.name, n: L2.order[e3.people[0]] ?? 0, size: "sm" });
      const x2 = L2.payment[e3.payment];
      return x2 ? /* @__PURE__ */ u3(Mark2, { brand: brandOf(x2.institution, x2.name), kind: x2.kind, name: x2.name, size: "sm" }) : /* @__PURE__ */ u3(Dot, { color: e3.amount > 0 ? "in" : "out" });
    };
    const said = (e3) => e3.people ? e3.people.map((id2) => L2.person[id2]?.name || id2).join(" and ") + "'s paycheck" : L2.payment[e3.payment]?.name || e3.payment;
    return /* @__PURE__ */ u3(
      Widget,
      {
        title: span === "31" ? "Checking, next 30 days" : "Checking, next 3 months",
        span: 2,
        kind: "fx-checking",
        actions: /* @__PURE__ */ u3(Segmented, { label: "How far ahead", value: span, pick: setSpan, options: [["31", "30 days"], ["93", "3 months"]] }),
        children: [
          /* @__PURE__ */ u3(
            Stat,
            {
              value: /* @__PURE__ */ u3(Amount, { value: now }),
              caption: "Today",
              aside: /* @__PURE__ */ u3("div", { class: "fx-right", children: [
                /* @__PURE__ */ u3(Amount, { value: values[low], form: "full", tone: values[low] < cushion ? "out" : "" }),
                /* @__PURE__ */ u3("div", { class: "fx-sub", children: [
                  "lowest, ",
                  dayLong(days[low].date),
                  values[low] < cushion ? `, under your ${compact(cushion)} cushion` : ""
                ] })
              ] })
            }
          ),
          /* @__PURE__ */ u3(
            AreaChart,
            {
              values,
              xLabels,
              marks: marks2,
              height: 300,
              threshold: cushion || void 0,
              format: tick,
              band: from >= 0 && to > from ? { from, to } : void 0,
              label: `Checking each day from ${dayShort(days[0].date)} to ${dayShort(days[days.length - 1].date)}: ${money(now)} today, lowest ${money(values[low])} on ${dayShort(days[low].date)}. The paycheck's payments list every number.`,
              tip: (i3) => /* @__PURE__ */ u3(S, { children: [
                /* @__PURE__ */ u3("div", { class: "fx-tiphead", children: [
                  /* @__PURE__ */ u3("span", { children: dayLong(days[i3].date) }),
                  /* @__PURE__ */ u3(Amount, { value: days[i3].balance, form: "full" })
                ] }),
                (days[i3].events || []).slice(0, 6).map((e3, k3) => /* @__PURE__ */ u3("div", { class: "fx-tiprow", children: [
                  lead(e3),
                  /* @__PURE__ */ u3("span", { children: said(e3) }),
                  /* @__PURE__ */ u3("span", { class: e3.amount > 0 ? "fx-in" : "", children: signed(e3.amount) })
                ] }, k3)),
                !(days[i3].events || []).length && /* @__PURE__ */ u3("div", { class: "fx-sub", style: { marginTop: "4px" }, children: "Nothing comes or goes" })
              ] })
            }
          ),
          /* @__PURE__ */ u3("ul", { class: "fx-legend inline", "aria-hidden": "true", children: [
            /* @__PURE__ */ u3("li", { children: [
              /* @__PURE__ */ u3(Dot, { color: "in" }),
              /* @__PURE__ */ u3("span", { class: "fx-legendlabel", children: "Paycheck" })
            ] }),
            /* @__PURE__ */ u3("li", { children: [
              /* @__PURE__ */ u3(Dot, { color: "out" }),
              /* @__PURE__ */ u3("span", { class: "fx-legendlabel", children: [
                "Bill of ",
                compact(bigBill),
                " or more"
              ] })
            ] }),
            !!cushion && /* @__PURE__ */ u3("li", { children: [
              /* @__PURE__ */ u3(Dot, { color: "out", shape: "dash" }),
              /* @__PURE__ */ u3("span", { class: "fx-legendlabel", children: [
                compact(cushion),
                " cushion"
              ] })
            ] }),
            from >= 0 && /* @__PURE__ */ u3("li", { children: [
              /* @__PURE__ */ u3(Dot, { color: "accent", shape: "square" }),
              /* @__PURE__ */ u3("span", { class: "fx-legendlabel", children: "The paycheck picked" })
            ] })
          ] })
        ]
      }
    );
  }

  // web/src/finances/widgets/Flow.tsx
  var ahead = 6;
  function CashFlowWidget({ v: v3, L: L2, sel: sel2, pick }) {
    const m3 = month(v3, L2);
    const first = v3.periods[0]?.now ? 1 : 0;
    const periods = v3.periods.slice(first, first + ahead);
    return /* @__PURE__ */ u3(Widget, { title: "Cash flow", kind: "fx-flow", children: [
      /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: m3.left, sign: true, tone: "auto" }), caption: "Left in a typical month" }),
      /* @__PURE__ */ u3(SplitBar, { label: "A typical month's pay", parts: [{ label: "Spent", value: m3.spent, color: "out" }, { label: "Saved", value: m3.saved, color: "save" }, { label: "Left", value: Math.max(0, m3.left), color: "in" }] }),
      /* @__PURE__ */ u3(Tiles2, { items: [
        { label: "Income", value: whole(m3.in), tone: "in" },
        { label: "Spending", value: whole(m3.spent), tone: "out" },
        { label: "Saved", value: m3.in ? `${Math.round((m3.saved + m3.viaPay) / (m3.in + m3.viaPay) * 100)}%` : whole(m3.saved), tone: "save" }
      ] }),
      !!periods.length && /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("div", { class: "fx-caption", children: "Each paycheck, after its bills" }),
        /* @__PURE__ */ u3(
          Bars2,
          {
            bars: periods.map((p3) => ({ label: dayShort(p3.pay?.date || p3.start), sub: p3.pay?.people.map((id2) => L2.person[id2]?.name || id2).join(" & "), value: surplus(p3) })),
            picked: sel2 - first,
            pick: (i3) => pick(i3 + first),
            label: "What each paycheck leaves after the bills it covers; pick one to see its payments.",
            say: (b2) => `${b2.label}, ${b2.sub}: ${b2.value < 0 ? `short ${money(-b2.value)}` : `${money(b2.value)} left`}`
          }
        )
      ] })
    ] });
  }
  var kindHue = { home: 8, cards: 7, spending: 2, car: 1, utilities: 3, subscriptions: 5, loans: 4, other: 6 };
  function SpendingWidget({ v: v3, L: L2 }) {
    const m3 = month(v3, L2);
    if (!m3.byKind.length) return null;
    const slices = m3.byKind.map((k3) => ({ label: kindName(k3.kind), value: k3.amount, color: kindHue[k3.kind] ?? 6 }));
    return /* @__PURE__ */ u3(Widget, { title: "Where it goes", kind: "fx-spend", children: [
      /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: -m3.spent }), caption: "Spent in a typical month" }),
      /* @__PURE__ */ u3("div", { class: "fx-donutrow", children: [
        /* @__PURE__ */ u3(Donut, { slices, label: "A typical month's spending", center: /* @__PURE__ */ u3(S, { children: [
          /* @__PURE__ */ u3("strong", { children: whole(m3.spent) }),
          "a month"
        ] }) }),
        /* @__PURE__ */ u3(Legend, { items: slices.slice(0, 6).map((s3) => ({ label: s3.label, color: s3.color, value: whole(s3.value) })) })
      ] })
    ] });
  }

  // web/src/finances/widgets/Paycheck.tsx
  var shown3 = 5;
  var names = (ids, L2) => ids.map((id2) => L2.person[id2]?.name || id2).join(" and ");
  function PaycheckWidget({ v: v3, L: L2, sel: sel2, edit }) {
    const [all, setAll] = d2(false);
    const p3 = v3.periods[Math.min(sel2, v3.periods.length - 1)];
    if (!p3) return null;
    const rows = all ? p3.rows : p3.rows.slice(0, shown3);
    const cushion = v3.plan.cushion || 0;
    const title = p3.now ? "Coming up" : `${names(p3.pay.people, L2)} · ${dayLong(p3.pay.date)}`;
    return /* @__PURE__ */ u3(Widget, { title, kind: "fx-paycheck", children: [
      /* @__PURE__ */ u3(
        Stat,
        {
          value: /* @__PURE__ */ u3(Amount, { value: p3.left, tone: p3.left < 0 ? "out" : p3.left < cushion ? "warn" : "" }),
          caption: /* @__PURE__ */ u3(S, { children: [
            p3.now ? `Checking on ${dayShort(p3.last)}, before the next paycheck` : `Checking on ${dayShort(p3.last)}, after its bills`,
            p3.left < 0 ? /* @__PURE__ */ u3("span", { class: "fx-out", children: [
              ", short ",
              money(-p3.left)
            ] }) : p3.left < cushion ? /* @__PURE__ */ u3("span", { children: [
              ", under your ",
              compact(cushion),
              " cushion"
            ] }) : ""
          ] }),
          aside: !p3.now && /* @__PURE__ */ u3(Delta, { value: p3.in - p3.out })
        }
      ),
      /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: [
        !p3.now && /* @__PURE__ */ u3(
          Row,
          {
            lead: /* @__PURE__ */ u3(Who, { name: L2.person[p3.pay.people[0]]?.name, n: L2.order[p3.pay.people[0]] ?? 0 }),
            title: `${names(p3.pay.people, L2)}'s paycheck`,
            sub: dayLong(p3.pay.date),
            when: /* @__PURE__ */ u3(Amount, { value: p3.pay.amount, sign: true, tone: "in", form: "full" }),
            whenPlain: true
          }
        ),
        rows.map((r3, i3) => {
          const x2 = L2.payment[r3.payment];
          const src = L2.account[x2?.from];
          const via = r3.outside || r3.into ? (src?.kind === "card" ? "on " : "from ") + (src?.name || "another account") : kindName(x2?.kind || "other");
          return /* @__PURE__ */ u3(
            Row,
            {
              lead: /* @__PURE__ */ u3(Mark2, { brand: brandOf(x2?.institution, x2?.name), kind: x2?.kind, name: x2?.name }),
              title: /* @__PURE__ */ u3(S, { children: [
                x2?.name || r3.payment,
                r3.estimate && /* @__PURE__ */ u3("span", { class: "fx-sub", children: " (about)" })
              ] }),
              sub: `${dayShort(r3.date)} · ${via}`,
              when: /* @__PURE__ */ u3(Amount, { value: r3.into ? r3.amount : -r3.amount, sign: r3.into, tone: r3.into ? "in" : "", form: "full" }),
              whenPlain: true,
              onOpen: edit && x2 ? () => edit("payment", x2.id) : void 0,
              openLabel: x2 ? "edit" : void 0
            },
            i3
          );
        }),
        !p3.rows.length && /* @__PURE__ */ u3("li", { children: /* @__PURE__ */ u3(Empty, { children: "Nothing to pay before the next paycheck." }) })
      ] }),
      p3.rows.length > shown3 && /* @__PURE__ */ u3("p", { class: "actions fx-more", children: /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: () => setAll(!all), children: all ? "Show fewer" : `Show all ${p3.rows.length} payments` }) })
    ] });
  }

  // web/src/finances/widgets/Worth.tsx
  function NetWorthWidget({ v: v3, open: open2 }) {
    if (!(v3.plan.accounts || []).length) return null;
    const now = netWorth(v3);
    const kept = (v3.worth || []).filter((p3) => p3.date < v3.today);
    const values = [...kept.map((p3) => p3.amount), now];
    const month3 = worthByMonth(v3, 1, 0)[0];
    const each = (v3.plan.accounts || []).map((a3) => worthOf(v3, a3));
    const owned = each.filter((n2) => n2 > 0).reduce((t3, n2) => t3 + n2, 0), owes = -each.filter((n2) => n2 < 0).reduce((t3, n2) => t3 + n2, 0);
    return /* @__PURE__ */ u3(Widget, { title: "Net worth", kind: "fx-worthmini", actions: /* @__PURE__ */ u3(IconButton, { icon: "open", label: "Open Net worth", onClick: open2 }), children: [
      /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: now }), caption: "Today", aside: month3 && /* @__PURE__ */ u3(Delta, { value: now - month3.net, base: month3.net, shareOnly: true }) }),
      values.length > 2 && /* @__PURE__ */ u3(
        AreaChart,
        {
          values,
          zero: false,
          axis: false,
          height: 92,
          fill: true,
          format: tick,
          xLabels: [{ i: 0, label: dayShort(kept[0]?.date || v3.today) }, { i: values.length - 1, label: "Today" }],
          label: `Net worth from ${money(values[0])} on ${dayShort(kept[0]?.date || v3.today)} to ${money(now)} today.`,
          tip: (i3) => /* @__PURE__ */ u3("div", { class: "fx-tiphead", children: [
            /* @__PURE__ */ u3("span", { children: i3 === values.length - 1 ? "Today" : dayShort(kept[i3].date) }),
            /* @__PURE__ */ u3(Amount, { value: values[i3], form: "whole" })
          ] })
        }
      ),
      /* @__PURE__ */ u3("div", { class: "fx-pair", children: [
        /* @__PURE__ */ u3(Stat, { size: "sm", value: /* @__PURE__ */ u3(Amount, { value: owned, form: "whole" }), caption: "Owned" }),
        /* @__PURE__ */ u3(Stat, { size: "sm", value: /* @__PURE__ */ u3(Amount, { value: owes, form: "whole" }), caption: "Owed" })
      ] })
    ] });
  }
  function Balances({ v: v3, open: open2 }) {
    const list = grouped(v3);
    if (!list.length) return null;
    return /* @__PURE__ */ u3("div", { class: "fx-balances", role: "group", "aria-label": "Balances", children: [
      /* @__PURE__ */ u3("div", { class: "fx-caption", children: "Accounts" }),
      list.map((g2) => /* @__PURE__ */ u3("button", { type: "button", class: "fx-balance", onClick: () => open2(g2.key), children: [
        /* @__PURE__ */ u3(Dot, { color: g2.color }),
        /* @__PURE__ */ u3("span", { class: "fx-legendlabel", children: g2.name }),
        /* @__PURE__ */ u3(Amount, { value: g2.total, form: "compact", tone: g2.total < 0 ? "out" : "" })
      ] }, g2.key)),
      /* @__PURE__ */ u3("div", { class: "fx-balance total", children: [
        /* @__PURE__ */ u3("span", { class: "fx-legendlabel", children: "Net worth" }),
        /* @__PURE__ */ u3("span", { class: "fx-amount", children: compact(netWorth(v3)) })
      ] })
    ] });
  }
  function mountBalances(el, v3, open2) {
    R(v3 ? /* @__PURE__ */ u3(Balances, { v: v3, open: open2 }) : null, el);
  }

  // web/src/finances/widgets/Ledger.tsx
  function SinceWidget({ v: v3, L: L2, set: set2 }) {
    const [busy, setBusy] = d2("");
    const [all, setAll] = d2(false);
    const list = v3.since || [];
    const pick = async (s3, choice) => {
      if (choice === "not" === !!s3.waiting || busy) return;
      setBusy(s3.key);
      await set2(s3.key, choice === "not");
      setBusy("");
    };
    const name = (s3) => s3.person ? `${L2.person[s3.person]?.name || s3.person}'s paycheck` : L2.payment[s3.payment]?.name || s3.payment;
    const shown5 = all ? list : list.slice(0, 5);
    return /* @__PURE__ */ u3(Widget, { title: "Taken as done", span: "all", kind: "fx-since", children: [
      /* @__PURE__ */ u3("p", { class: "fx-sub fx-lead", children: [
        "Dated on or after the day you typed in the balances, so counted in them.",
        set2 && " Mark any that hasn't happened yet: it comes today."
      ] }),
      /* @__PURE__ */ u3(Rows, { kind: "finrows fx-rows", children: shown5.map((s3) => {
        const x2 = s3.payment ? L2.payment[s3.payment] : void 0;
        return /* @__PURE__ */ u3(
          Row,
          {
            lead: s3.person ? /* @__PURE__ */ u3(Who, { name: L2.person[s3.person]?.name, n: L2.order[s3.person] ?? 0 }) : /* @__PURE__ */ u3(Mark2, { brand: brandOf(x2?.institution, x2?.name), kind: x2?.kind, name: x2?.name }),
            title: name(s3),
            sub: dayLong(s3.date) + (s3.waiting ? " · not yet: it comes today" : s3.typed ? " · the day its balance was typed in" : " · since the balance was typed in"),
            end: set2 && /* @__PURE__ */ u3(Segmented, { label: `${name(s3)}, ${dayLong(s3.date)}`, value: s3.waiting ? "not" : "in", pick: (c3) => pick(s3, c3), options: [["in", "In"], ["not", "Not yet"]] }),
            when: /* @__PURE__ */ u3("span", { class: s3.in ? "fx-amount fx-in" : "fx-amount", children: [
              s3.in ? "+" : s3.outside ? "" : "−",
              money(s3.amount)
            ] }),
            whenPlain: true
          },
          s3.key
        );
      }) }),
      list.length > 5 && /* @__PURE__ */ u3("p", { class: "actions", children: /* @__PURE__ */ u3("button", { class: "small", onClick: () => setAll(!all), children: all ? "Show fewer" : `Show all ${list.length}` }) })
    ] });
  }
  var shown4 = (a3) => ["checking", "savings", "investment", "retirement", "card"].includes(a3.kind);
  var postCols = 7;
  function PostPayWidget({ v: v3, L: L2, sel: sel2, pick, saveBalances: saveBalances2, add }) {
    const accounts = (v3.plan.accounts || []).filter(shown4);
    const cols = v3.periods.slice(0, postCols);
    const [editing2, setEditing] = d2(false);
    const [typed, setTyped] = d2({});
    const [busy, setBusy] = d2(false);
    const first = A2(null);
    _2(() => {
      if (editing2) first.current?.focus();
    }, [editing2]);
    const val = (key2, n2) => typed[key2] ?? String(n2 || 0);
    const est = (a3) => owed(a3.kind) ? Math.max(0, cents((v3.start?.[a3.id] ?? a3.balance + (a3.pending || 0)) - (a3.pending || 0))) : v3.start?.[a3.id] ?? a3.balance;
    const read = (key2, was) => {
      const n2 = parseAmount(typed[key2] ?? "");
      return isNaN(n2) ? was : n2;
    };
    const done = async (e3) => {
      e3?.preventDefault();
      const out = {};
      for (const a3 of accounts) out[a3.id] = { balance: read(a3.id, est(a3)), pending: read(a3.id + ":p", a3.pending || 0) };
      setBusy(true);
      const ok = await saveBalances2(out, Math.max(0, read("cushion", v3.plan.cushion || 0)));
      setBusy(false);
      if (ok) setEditing(false);
    };
    const type = (key2) => (e3) => setTyped({ ...typed, [key2]: e3.target.value });
    const today = (a3) => owed(a3.kind) ? -(est(a3) + (a3.pending || 0)) : est(a3);
    const at = (a3, p3) => owed(a3.kind) ? -(p3.accounts?.[a3.id] ?? 0) : p3.accounts?.[a3.id] ?? a3.balance;
    const total = (f4) => accounts.reduce((t3, a3) => t3 + f4(a3), 0);
    const change = (d3) => Math.abs(d3) >= 5e-3 && /* @__PURE__ */ u3("span", { class: "delta " + (d3 < 0 ? "bad" : "ok"), children: signed(d3) });
    const head = (p3) => p3.now ? /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("span", { children: [
        "Until ",
        dayShort(p3.last)
      ] }),
      /* @__PURE__ */ u3("small", { children: "Now" })
    ] }) : /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("span", { children: dayShort(p3.pay.date) }),
      /* @__PURE__ */ u3("small", { children: p3.pay.people.map((id2) => L2.person[id2]?.name || id2).join(" and ") })
    ] });
    return /* @__PURE__ */ u3(
      Widget,
      {
        span: "all",
        kind: "finpost",
        title: /* @__PURE__ */ u3(S, { children: [
          "Accounts, paycheck by paycheck ",
          /* @__PURE__ */ u3("span", { class: "fx-sub", children: "after the bills" })
        ] }),
        actions: (
          /* Keyed apart: Update balances must not become Save under the same click, or the click submits it. */
          /* @__PURE__ */ u3("span", { class: "toolbar", children: [
            editing2 && /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: () => setEditing(false), disabled: busy, children: "Cancel" }, "cancel"),
            editing2 ? /* @__PURE__ */ u3("button", { type: "submit", form: "finPostForm", class: "primary small", disabled: busy, children: "Save" }, "save") : saveBalances2 && /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: () => {
              setTyped({});
              setEditing(true);
            }, disabled: !accounts.length, children: "Update balances" }, "update")
          ] })
        ),
        children: accounts.length ? /* @__PURE__ */ u3("form", { id: "finPostForm", onSubmit: done, onKeyDown: (e3) => {
          if (e3.key === "Escape" && editing2) {
            e3.stopPropagation();
            setEditing(false);
          }
        }, children: [
          /* @__PURE__ */ u3("div", { class: "finpostscroll", children: /* @__PURE__ */ u3("table", { class: "finpost", children: [
            /* @__PURE__ */ u3("thead", { children: /* @__PURE__ */ u3("tr", { children: [
              /* @__PURE__ */ u3("th", { scope: "col", children: "Account" }),
              /* @__PURE__ */ u3("th", { scope: "col", class: "today", children: [
                /* @__PURE__ */ u3("span", { children: "Today" }),
                /* @__PURE__ */ u3("small", { children: editing2 ? "Type what each has" : dayShort(v3.today) })
              ] }),
              cols.map((p3, i3) => /* @__PURE__ */ u3("th", { scope: "col", class: i3 === sel2 ? "on" : "", children: /* @__PURE__ */ u3("button", { type: "button", "aria-pressed": i3 === sel2, onClick: () => pick(i3), children: head(p3) }) }, p3.start))
            ] }) }),
            /* @__PURE__ */ u3("tbody", { children: accounts.map((a3, n2) => {
              const typedNow = typed[a3.id] !== void 0 && !isNaN(parseAmount(typed[a3.id])) ? parseAmount(typed[a3.id]) - est(a3) : 0;
              return /* @__PURE__ */ u3("tr", { children: [
                /* @__PURE__ */ u3("th", { scope: "row", children: /* @__PURE__ */ u3("span", { class: "acct", children: [
                  /* @__PURE__ */ u3(Mark2, { brand: brandOf(a3.institution, a3.name), kind: a3.kind, name: a3.name, size: "sm" }),
                  /* @__PURE__ */ u3("span", { children: [
                    /* @__PURE__ */ u3("strong", { children: a3.name }),
                    (a3.kind === "card" ? a3.pending ? `${money(a3.pending)} pending` : "" : a3.detail) && /* @__PURE__ */ u3("small", { children: a3.kind === "card" ? `${money(a3.pending)} pending` : a3.detail })
                  ] })
                ] }) }),
                /* @__PURE__ */ u3("td", { class: "today", children: editing2 ? /* @__PURE__ */ u3("span", { class: "fininputs", children: [
                  /* @__PURE__ */ u3("input", { ref: n2 === 0 ? first : void 0, class: "moneyin", inputmode: "decimal", "aria-label": `${a3.name} ${owed(a3.kind) ? "owed" : "today"}`, value: val(a3.id, est(a3)), onInput: type(a3.id) }),
                  a3.kind === "card" && /* @__PURE__ */ u3("input", { class: "moneyin", inputmode: "decimal", "aria-label": `${a3.name} pending`, placeholder: "Pending", value: val(a3.id + ":p", a3.pending || 0), onInput: type(a3.id + ":p") }),
                  /* @__PURE__ */ u3("small", { children: Math.abs(typedNow) >= 5e-3 ? /* @__PURE__ */ u3(S, { children: [
                    "expected ",
                    money(est(a3)),
                    ", ",
                    /* @__PURE__ */ u3("span", { class: typedNow < 0 === !owed(a3.kind) ? "bad" : "ok", children: signed(typedNow) })
                  ] }) : `expected ${money(est(a3))}` })
                ] }) : /* @__PURE__ */ u3("span", { class: "num", children: money(today(a3)) }) }),
                cols.map((p3, i3) => {
                  const was = i3 ? at(a3, cols[i3 - 1]) : today(a3), now = at(a3, p3);
                  return /* @__PURE__ */ u3("td", { class: i3 === sel2 ? "on" : "", children: [
                    /* @__PURE__ */ u3("span", { class: "num" + (a3.id === v3.checking && p3.left < (v3.plan.cushion || 0) ? p3.left < 0 ? " bad" : " warn" : ""), children: money(now) }),
                    change(now - was)
                  ] }, p3.start);
                })
              ] }, a3.id);
            }) }),
            /* @__PURE__ */ u3("tfoot", { children: /* @__PURE__ */ u3("tr", { children: [
              /* @__PURE__ */ u3("th", { scope: "row", children: "Total" }),
              /* @__PURE__ */ u3("td", { class: "today", children: /* @__PURE__ */ u3("span", { class: "num", children: money(total(today)) }) }),
              cols.map((p3, i3) => /* @__PURE__ */ u3("td", { class: i3 === sel2 ? "on" : "", children: /* @__PURE__ */ u3("span", { class: "num", children: money(total((a3) => at(a3, p3))) }) }, p3.start))
            ] }) })
          ] }) }),
          editing2 && /* @__PURE__ */ u3("label", { class: "field cushion", children: [
            "Flag checking under ",
            /* @__PURE__ */ u3("span", { class: "moneyfield", children: [
              /* @__PURE__ */ u3("span", { "aria-hidden": "true", children: currencySign() }),
              /* @__PURE__ */ u3("input", { inputmode: "decimal", value: val("cushion", v3.plan.cushion || 0), onInput: type("cushion") })
            ] })
          ] })
        ] }) : /* @__PURE__ */ u3(Empty, { children: [
          "No accounts yet.",
          add && /* @__PURE__ */ u3(S, { children: [
            " ",
            /* @__PURE__ */ u3("button", { class: "small", onClick: () => add("account", "checking"), children: "Add your checking account" })
          ] })
        ] })
      }
    );
  }

  // web/src/finances/Overview.tsx
  function Overview({ v: v3, L: L2, sel: sel2, pick, saveBalances: saveBalances2, add, edit, setWaiting: setWaiting2, openWorth }) {
    const picked = Math.min(sel2, v3.periods.length - 1);
    if (!v3.plan.accounts?.length && !v3.plan.people?.length && !add) return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3(Card, { kind: "finstart", children: /* @__PURE__ */ u3(Empty, { children: "Nothing typed in yet: Finances are filled in on the computer, or on a phone allowed to change them." }) }) });
    if (!v3.plan.accounts?.length && !v3.plan.people?.length) {
      return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3("div", { class: "fx-board", children: /* @__PURE__ */ u3(Widget, { title: "Start with three things", span: "all", kind: "finstart", children: /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: [
        /* @__PURE__ */ u3(Row, { lead: /* @__PURE__ */ u3(Mark2, { kind: "checking", name: "Checking" }), title: "Your checking account", sub: "Where paychecks land and bills come out", end: /* @__PURE__ */ u3("button", { class: "small", onClick: () => add("account", "checking"), children: "Add an account" }) }),
        /* @__PURE__ */ u3(Row, { lead: /* @__PURE__ */ u3(Mark2, { kind: "savings", name: "Pay" }), title: "Who gets paid, and when", sub: "Every other Friday, the 26th, twice a month", end: /* @__PURE__ */ u3("button", { class: "small", onClick: () => add("person"), children: "Add a paycheck" }) }),
        /* @__PURE__ */ u3(Row, { lead: /* @__PURE__ */ u3(Mark2, { kind: "home", name: "Bills" }), title: "What comes out each month", sub: "The mortgage, the car, subscriptions, a card's balance", end: /* @__PURE__ */ u3("button", { class: "small", onClick: () => add("payment"), children: "Add a payment" }) })
      ] }) }) }) });
    }
    return /* @__PURE__ */ u3("div", { class: "fin", children: [
      !v3.checking && /* @__PURE__ */ u3(Card, { kind: "finnote", role: "status", children: [
        /* @__PURE__ */ u3(Mark2, { kind: "checking", name: "Checking" }),
        /* @__PURE__ */ u3("span", { class: "grow", children: [
          /* @__PURE__ */ u3("strong", { children: "No checking account yet." }),
          " Paychecks land in it and payments come out of it, so until there is one every balance below reads $0.00."
        ] }),
        add && /* @__PURE__ */ u3("button", { class: "small", onClick: () => add("account", "checking"), children: "Add your checking account" })
      ] }),
      /* @__PURE__ */ u3("div", { class: "fx-board", children: [
        !!v3.since?.length && /* @__PURE__ */ u3(SinceWidget, { v: v3, L: L2, set: setWaiting2 }),
        /* @__PURE__ */ u3(CheckingWidget, { v: v3, L: L2, sel: picked }),
        /* @__PURE__ */ u3(PaycheckWidget, { v: v3, L: L2, sel: picked, edit }),
        /* @__PURE__ */ u3(CashFlowWidget, { v: v3, L: L2, sel: picked, pick }),
        /* @__PURE__ */ u3(SpendingWidget, { v: v3, L: L2 }),
        /* @__PURE__ */ u3(NetWorthWidget, { v: v3, open: openWorth }),
        /* @__PURE__ */ u3(PostPayWidget, { v: v3, L: L2, sel: picked, pick, saveBalances: saveBalances2, add })
      ] })
    ] });
  }

  // web/src/finances/Worth.tsx
  var ranges = [["3", "3 months", 3], ["6", "6 months", 6], ["12", "1 year", 12], ["all", "All", 600]];
  function ago2(day3, today) {
    if (!day3) return "not typed in yet";
    const n2 = daysBetween(day3, today);
    return n2 <= 0 ? "updated today" : n2 === 1 ? "updated yesterday" : n2 < 14 ? `updated ${n2} days ago` : `updated ${dayShort(day3)}`;
  }
  var month2 = (day3) => monthName(day3).slice(0, 3);
  function NetWorth({ v: v3, L: L2, edit }) {
    const [range, setRange] = d2("3");
    const [counted, setCounted] = d2("all");
    const accounts = v3.plan.accounts || [];
    if (!accounts.length && !edit) return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3(Card, { kind: "finstart", children: /* @__PURE__ */ u3(Empty, { children: "No accounts typed in yet." }) }) });
    if (!accounts.length) {
      return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3("div", { class: "fx-board", children: /* @__PURE__ */ u3(Widget, { title: "Nothing here yet", span: "all", kind: "finstart", children: /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: [
        /* @__PURE__ */ u3(Row, { lead: /* @__PURE__ */ u3(Mark2, { kind: "checking", name: "Accounts" }), title: "Bank accounts, cards, and investments", sub: "What each holds, typed in", end: /* @__PURE__ */ u3("button", { class: "small", onClick: () => edit("account"), children: "Add an account" }) }),
        /* @__PURE__ */ u3(Row, { lead: /* @__PURE__ */ u3(Mark2, { kind: "home", name: "Home" }), title: "A home or a car", sub: "What it is worth, and the loan against it: its equity", end: /* @__PURE__ */ u3("button", { class: "small", onClick: () => edit("account"), children: "Add property" }) })
      ] }) }) }) });
    }
    const kept = parseDay(firstKept(v3)), today = parseDay(v3.today);
    const back = Math.max(1, Math.min(ranges.find(([k3]) => k3 === range)?.[2] ?? 3, (today.getFullYear() - kept.getFullYear()) * 12 + today.getMonth() - kept.getMonth()));
    const months = worthByMonth(v3, back, 3);
    const start = months[0];
    const now = netWorth(v3);
    const owned = accounts.filter((a3) => !owed(a3.kind));
    const debts = accounts.filter((a3) => owed(a3.kind));
    const owes = debts.reduce((t3, a3) => t3 - worthOf(v3, a3), 0);
    const loans = debts.filter((a3) => a3.kind === "loan");
    const onLoans = loans.reduce((t3, a3) => t3 - worthOf(v3, a3), 0);
    const loanDrop = loans.reduce((t3, a3) => t3 + (worthOf(v3, a3) - worthOn(v3, a3, start.date)), 0);
    const ownedKeys = groups.filter((g2) => g2.key !== "cards" && g2.key !== "loans" && months.some((m3) => (m3.owned[g2.key] || 0) > 0));
    const netted = months.some((m3) => m3.secured > 0);
    const hasHome = ownedKeys.some((g2) => g2.key === "property");
    const homeToo = counted === "all" || !hasHome;
    const keys2 = ownedKeys.filter((g2) => homeToo || g2.key !== "property");
    const named3 = (g2) => netted && g2.key === "property" ? `${g2.name}, less their loans` : g2.name;
    const bars = (m3) => {
      const equity = (m3.owned.property || 0) - m3.secured;
      const up = keys2.map((g2) => ({ key: g2.key, value: g2.key === "property" ? Math.max(equity, 0) : m3.owned[g2.key] || 0, color: g2.color }));
      return { up, down: m3.owes - m3.secured + (homeToo ? Math.max(-equity, 0) : 0), net: homeToo ? m3.net : m3.net - equity };
    };
    const owedName = netted ? "Other debts" : "Owed";
    const netName = homeToo ? "Net worth" : "Net worth without home and car";
    const sorted = (list) => [...list].sort((a3, b2) => Math.abs(worthOf(v3, b2)) - Math.abs(worthOf(v3, a3)));
    const row = (a3) => {
      const w3 = worthOf(v3, a3), d3 = w3 - worthOn(v3, a3, start.date);
      const loan = a3.loan ? accounts.find((x2) => x2.id === a3.loan) : void 0;
      const paid = a3.original ? Math.max(0, Math.min(1, (a3.original - a3.balance) / a3.original)) : -1;
      const sub = loan ? `${money(todayOf(v3, a3) - todayOf(v3, loan))} equity` : paid >= 0 ? `${Math.round(paid * 100)}% of ${whole(a3.original)} paid` : a3.kind === "card" && a3.pending ? `${money(a3.pending)} pending` : ago2(a3.updated, v3.today);
      return /* @__PURE__ */ u3(
        Row,
        {
          lead: /* @__PURE__ */ u3(Mark2, { brand: brandOf(a3.institution, a3.name), kind: a3.kind, name: a3.name }),
          title: a3.name,
          sub,
          end: Math.abs(d3) >= 0.5 ? /* @__PURE__ */ u3("span", { class: "fx-change " + (d3 > 0 ? "fx-in" : "fx-out"), title: `Since ${dayShort(start.date)}`, children: [
            /* @__PURE__ */ u3("span", { "aria-hidden": "true", children: d3 > 0 === w3 >= 0 ? "↑ " : "↓ " }),
            compact(Math.abs(d3)),
            /* @__PURE__ */ u3("span", { class: "fx-hidden", children: [
              " ",
              w3 >= 0 ? d3 > 0 ? "more" : "less" : d3 > 0 ? "less owed" : "more owed",
              " since ",
              dayShort(start.date)
            ] })
          ] }) : void 0,
          when: /* @__PURE__ */ u3(Amount, { value: Math.abs(w3), form: "full" }),
          whenPlain: true,
          onOpen: edit ? () => edit("account", a3.id) : void 0,
          openLabel: "edit"
        },
        a3.id
      );
    };
    return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3("div", { class: "fx-board", children: [
      /* @__PURE__ */ u3(Widget, { title: "Net worth", kind: "fx-figurecard", children: /* @__PURE__ */ u3(Stat, { size: "lg", value: /* @__PURE__ */ u3(Amount, { value: now }) }) }),
      /* @__PURE__ */ u3(Widget, { title: `Since ${dayShort(start.date)}`, kind: "fx-figurecard", children: /* @__PURE__ */ u3(Stat, { size: "lg", value: /* @__PURE__ */ u3(Amount, { value: now - start.net, sign: true, tone: "auto" }), aside: /* @__PURE__ */ u3(Delta, { value: now - start.net, base: start.net, shareOnly: true }) }) }),
      /* @__PURE__ */ u3(Widget, { title: "What's owed", kind: "fx-figurecard", children: /* @__PURE__ */ u3("p", { class: "fx-say", children: [
        "You owe ",
        /* @__PURE__ */ u3(Amount, { value: owes, form: "full", tone: "out" }),
        loans.length ? /* @__PURE__ */ u3(S, { children: [
          onLoans > owes / 2 ? ", most of it on loans. They are" : ". Your loans are",
          " ",
          /* @__PURE__ */ u3(Amount, { value: Math.abs(loanDrop), form: "whole" }),
          " ",
          loanDrop >= 0 ? "smaller" : "larger",
          " than on ",
          dayShort(start.date),
          "."
        ] }) : "."
      ] }) }),
      /* @__PURE__ */ u3(
        Widget,
        {
          title: "Net worth by month",
          span: "all",
          kind: "fx-worthchart",
          actions: /* @__PURE__ */ u3(S, { children: [
            hasHome && /* @__PURE__ */ u3(Segmented, { label: "What it counts", value: counted, pick: setCounted, options: [["all", "Everything"], ["liquid", "Without home and car"]] }),
            /* @__PURE__ */ u3(Segmented, { label: "How far back", value: range, pick: setRange, options: ranges.map(([k3, t3]) => [k3, t3]) })
          ] }),
          children: [
            /* @__PURE__ */ u3(
              StackedBars,
              {
                format: tick,
                height: 280,
                label: `${netName} at each month's end, what is owned stacked above zero${homeToo && netted ? " (a home and car less their loans)" : ""} and what is owed below: ${months.map((m3) => `${month2(m3.date)} ${money(bars(m3).net)}${m3.ahead ? " ahead" : ""}`).join(", ")}.`,
                columns: months.map((m3) => ({
                  label: m3.date === v3.today ? "Now" : month2(m3.date),
                  up: bars(m3).up.map(({ value, color }) => ({ value, color })),
                  down: [{ value: bars(m3).down, color: 8 }],
                  line: bars(m3).net,
                  ahead: m3.ahead
                })),
                tip: (i3) => {
                  const m3 = months[i3], b2 = bars(m3);
                  return /* @__PURE__ */ u3(S, { children: [
                    /* @__PURE__ */ u3("div", { class: "fx-caption", children: m3.date === v3.today ? "Today" : `${dayShort(m3.date)}${m3.ahead ? ", ahead" : ""}` }),
                    /* @__PURE__ */ u3("div", { class: "fx-tiphead fx-gap", children: [
                      /* @__PURE__ */ u3("span", { children: "Owned" }),
                      /* @__PURE__ */ u3(Amount, { value: b2.up.reduce((t3, p3) => t3 + p3.value, 0), form: "full", tone: "in" })
                    ] }),
                    keys2.map((g2, k3) => /* @__PURE__ */ u3("div", { class: "fx-tiprow", children: [
                      /* @__PURE__ */ u3(Dot, { color: g2.color }),
                      /* @__PURE__ */ u3("span", { children: named3(g2) }),
                      /* @__PURE__ */ u3(Amount, { value: b2.up[k3].value, form: "full" })
                    ] }, g2.key)),
                    /* @__PURE__ */ u3("div", { class: "fx-tiphead fx-gap", children: [
                      /* @__PURE__ */ u3("span", { children: owedName }),
                      /* @__PURE__ */ u3(Amount, { value: -b2.down, form: "full", tone: "out" })
                    ] }),
                    /* @__PURE__ */ u3("div", { class: "fx-tiptotal", children: [
                      /* @__PURE__ */ u3("span", { children: netName }),
                      /* @__PURE__ */ u3(Amount, { value: b2.net, form: "full" })
                    ] })
                  ] });
                }
              }
            ),
            /* @__PURE__ */ u3(Legend, { layout: "inline", items: [
              ...keys2.map((g2) => ({ label: named3(g2), color: g2.color })),
              { label: owedName, color: 8 },
              { label: netName, color: "muted", shape: "line" },
              ...months.some((m3) => m3.ahead) ? [{ label: "Ahead, from your paychecks and bills", color: "muted", shape: "dash" }] : []
            ] })
          ]
        }
      ),
      /* @__PURE__ */ u3(Widget, { title: /* @__PURE__ */ u3(S, { children: [
        "What you own ",
        /* @__PURE__ */ u3("span", { class: "fx-sub", children: /* @__PURE__ */ u3(Amount, { value: owned.reduce((t3, a3) => t3 + worthOf(v3, a3), 0), form: "whole" }) })
      ] }), kind: "fx-ownlist", span: 2, children: /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: sorted(owned).map(row) }) }),
      /* @__PURE__ */ u3(Widget, { title: /* @__PURE__ */ u3(S, { children: [
        "What you owe ",
        /* @__PURE__ */ u3("span", { class: "fx-sub", children: /* @__PURE__ */ u3(Amount, { value: owes, form: "whole" }) })
      ] }), kind: "fx-owelist", children: debts.length ? /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: sorted(debts).map(row) }) : /* @__PURE__ */ u3(Empty, { children: "Nothing owed." }) })
    ] }) });
  }

  // web/src/finances/Finances.tsx
  var tabs = [["overview", "Dashboard"], ["recurring", "Recurring"], ["pay", "Pay"], ["worth", "Net worth"]];
  var adds = { overview: ["payment", "Add a payment"], recurring: ["payment", "Add a payment"], pay: ["person", "Add a paycheck"], worth: ["account", "Add an account"] };
  function FinancesScreen({ v: v3, error, retry, tab: tab2, setTab, sel: sel2, pick, saveBalances: saveBalances2, setWaiting: setWaiting2, saveSettings, edit, phone: phone2 }) {
    const L2 = v3 ? lookup(v3.plan) : null;
    setCurrency(v3?.plan.currency);
    const [what, label] = adds[tab2] || adds.overview;
    const ro = !!v3?.readOnly;
    const age = v3?.typed ? daysBetween(v3.typed, v3.today) : -1;
    const lead = (age < 0 ? phone2 ? "Typed in by you, kept on your homelab" : "Typed in by you, kept on this machine" : age === 0 ? "Balances from today" : `Balances from ${dayShort(v3.typed)}, with what's happened since` + (age >= 7 ? `: ${age} days ago${ro ? "" : ", update them with Edit"}` : "")) + (ro ? " · view only" : "");
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("div", { class: "row header", children: [
        /* @__PURE__ */ u3("div", { children: [
          /* @__PURE__ */ u3("h1", { children: "Finances" }),
          /* @__PURE__ */ u3("p", { class: "lead" + (age >= 7 ? " warn" : ""), children: lead })
        ] }),
        !ro && /* @__PURE__ */ u3("div", { class: "toolbar", children: /* @__PURE__ */ u3("button", { class: "btn fx-primary", onClick: () => edit(what), disabled: !v3, children: [
          /* @__PURE__ */ u3("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ u3("path", { d: "M12 5v14M5 12h14" }) }),
          label
        ] }) })
      ] }),
      /* @__PURE__ */ u3(Segmented, { label: "View", value: tab2, pick: setTab, options: tabs }),
      /* @__PURE__ */ u3("div", { class: "finbody", children: !v3 && error ? /* @__PURE__ */ u3(Empty, { children: [
        "The finances file could not be read: ",
        error,
        " ",
        /* @__PURE__ */ u3("button", { class: "small", onClick: retry, children: "Try again" })
      ] }) : !v3 ? /* @__PURE__ */ u3(Empty, { children: "Reading…" }) : ro ? /* @__PURE__ */ u3(View, { v: v3, L: L2, tab: tab2, sel: sel2, pick, openWorth: () => setTab("worth") }) : tab2 === "recurring" ? /* @__PURE__ */ u3(Recurring, { v: v3, L: L2, edit }) : tab2 === "pay" ? /* @__PURE__ */ u3(Pay, { v: v3, L: L2, edit, saveSettings }) : tab2 === "worth" ? /* @__PURE__ */ u3(NetWorth, { v: v3, L: L2, edit }) : /* @__PURE__ */ u3(Overview, { v: v3, L: L2, sel: sel2, pick, saveBalances: saveBalances2, setWaiting: setWaiting2, add: (w3, k3) => edit(w3, void 0, k3), edit: (w3, id2) => edit(w3, id2), openWorth: () => setTab("worth") }) })
    ] });
  }
  function View({ v: v3, L: L2, tab: tab2, sel: sel2, pick, openWorth }) {
    return tab2 === "recurring" ? /* @__PURE__ */ u3(Recurring, { v: v3, L: L2 }) : tab2 === "pay" ? /* @__PURE__ */ u3(Pay, { v: v3, L: L2 }) : tab2 === "worth" ? /* @__PURE__ */ u3(NetWorth, { v: v3, L: L2 }) : /* @__PURE__ */ u3(Overview, { v: v3, L: L2, sel: sel2, pick, openWorth });
  }
  function mountFinances(el, props) {
    R(/* @__PURE__ */ u3(FinancesScreen, { ...props }), el);
  }

  // web/src/screens/finances.ts
  var financesData = store(() => go().Finances());
  financesData.watch(draw3);
  function loadFinances() {
    return financesData.load();
  }
  var tab = "overview";
  var sel = null;
  var opened = 0;
  var editing = null;
  var phone = document.documentElement.classList.contains("companion");
  function draw3() {
    if (financesData.error) showError(financesData.error);
    const v3 = financesData.value || null;
    mountFinances($2("finRoot"), {
      v: v3,
      tab,
      sel: sel ?? (v3 && !v3.periods[0]?.now ? 0 : 1),
      error: financesData.error ? errorText(financesData.error) : void 0,
      retry: () => {
        financesData.load();
      },
      setTab: (t3) => {
        tab = t3;
        draw3();
      },
      pick: (i3) => {
        sel = i3;
        draw3();
      },
      saveBalances,
      edit: open,
      setWaiting,
      saveSettings: (s3) => save({ ...financesData.value.plan, currency: s3.currency, holidays: s3.holidays }),
      phone
    });
    if (editing && v3 && !v3.readOnly) mountFinanceSheet($2("finSheetBox"), { ...editing, plan: v3.plan, checking: v3.checking, save, close: close2 });
    mountBalances($2("finNav"), v3, () => {
      tab = "worth";
      draw3();
    });
    const low = v3 ? v3.periods.filter((p3) => p3.left < (v3.plan.cushion || 0)).length : 0;
    $2("financesCount").textContent = low ? String(low) : "";
  }
  async function save(plan) {
    try {
      financesData.set(await go().SaveFinances(plan));
      return true;
    } catch (e3) {
      showError(e3);
      financesData.load();
      return false;
    }
  }
  async function saveBalances(balances, cushion) {
    const plan = structuredClone(financesData.value.plan);
    const today = todayISO();
    for (const a3 of plan.accounts || []) {
      const b2 = balances[a3.id];
      if (!b2) continue;
      a3.balance = b2.balance;
      if (a3.kind === "card") a3.pending = b2.pending;
      a3.updated = today;
    }
    plan.cushion = cushion;
    plan.updated = today;
    return save(plan);
  }
  function setWaiting(key2, waiting) {
    const v3 = financesData.value;
    const keys2 = new Set((v3.since || []).filter((s3) => s3.waiting).map((s3) => s3.key));
    if (waiting) keys2.add(key2);
    else keys2.delete(key2);
    return save({ ...v3.plan, waiting: [...keys2], notYet: void 0 });
  }
  function open(what, id2, kind) {
    const v3 = financesData.value;
    if (!v3 || v3.readOnly) return;
    editing = { what, id: id2, kind, n: ++opened };
    mountFinanceSheet($2("finSheetBox"), { ...editing, plan: v3.plan, checking: v3.checking, save, close: close2 });
    $2("finSheet").hidden = false;
  }
  function close2() {
    editing = null;
    $2("finSheet").hidden = true;
  }
  mountFinanceSheet($2("finSheetBox"), null);
  draw3();

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
    if (name === "finances") financesData.fresh(minute);
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
    if (name === "finances") loadFinances();
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
  var screens = ["choose", "status", "backups", "setup", "settings", "finances"];
  $$("nav button").forEach((b2) => {
    b2.onclick = () => {
      navigate(b2.dataset.screen);
      focusScreen(b2.dataset.screen);
    };
    b2.title = `${b2.querySelector("span").textContent.trim()} (${mod}${screens.indexOf(b2.dataset.screen) + 1})`;
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
/*! Finances' logos: simple-icons (simpleicons.org), CC0; and selfh.st/icons
 * (selfh.st/icons, github.com/selfhst/icons), CC BY 4.0, by selfh.st. The
 * marks are their owners' trademarks, shown only beside the account or
 * payment they name. */
