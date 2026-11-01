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
  function Alerts({ events, problem, openSetup, refresh }) {
    const [checking, setChecking] = d2(false);
    const again = () => {
      setChecking(true);
      refresh().finally(() => setChecking(false));
    };
    const check = /* @__PURE__ */ u3("button", { id: "alertsCheck", class: "small", disabled: checking, title: "Reads the alerts again and leaves out those whose problem has cleared", onClick: again, children: checking ? "Checking…" : "Check again" });
    if (!events) {
      return /* @__PURE__ */ u3(CardHead, { title: "Recent alerts", children: /NTFY_READ_TOKEN/.test(problem || "") ? /* @__PURE__ */ u3("span", { class: "muted", children: [
        "They appear here once the alert token is set up. ",
        /* @__PURE__ */ u3(ActionLink, { onClick: openSetup, children: "Open Setup" })
      ] }) : /* @__PURE__ */ u3("span", { class: "muted", children: problem }) });
    }
    if (!events.length) return /* @__PURE__ */ u3(CardHead, { title: "Recent alerts", children: /* @__PURE__ */ u3("span", { children: [
      /* @__PURE__ */ u3("span", { class: "ok", children: "✓ None in the last 12 hours" }),
      " ",
      check
    ] }) });
    const shown5 = events.slice(0, 5);
    const tone = (e3) => (e3.priority || 0) >= 4 ? "bad" : (e3.tags || []).includes("white_check_mark") || /^recovered/i.test(e3.title || "") ? "ok" : "";
    return /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(CardHead, { title: "Recent alerts", children: /* @__PURE__ */ u3("span", { children: [
        /* @__PURE__ */ u3("span", { class: "muted", children: [
          events.length,
          " in the last 12 hours"
        ] }),
        " ",
        check
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
  var field = "input:not([disabled]):not([type=hidden]):not([type=checkbox]):not([type=file]):not([hidden]), select:not([disabled]), textarea:not([disabled])";
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
          class: "small",
          title: "A new password for their Jellyfin and Navidrome accounts (Infuse and music apps), on a fresh welcome page",
          disabled: busy === "password",
          onClick: async () => {
            if (await run("password")) on.openWelcome(p3.username);
          },
          children: "Reset password"
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
    const why = /* @__PURE__ */ u3("p", { class: "muted", children: "Each person gets one sign-in for the apps (with a passkey, no password to remember) and a welcome page with their apps and the phone apps to install. Jellyfin and Navidrome have a password of their own, for Infuse and music apps: with their keys in Settings, the homelab makes those accounts too, and Reset password gives a new one." });
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
    const byCategory2 = {};
    for (const a3 of p3.catalog.apps) if (a3.kind !== "helper" && matches(a3, p3.query)) (byCategory2[a3.category] ??= []).push(a3);
    if (p3.query && !Object.keys(byCategory2).length) return /* @__PURE__ */ u3(Empty, { children: [
      "No app matches “",
      p3.query,
      "”. Add your own below."
    ] });
    return /* @__PURE__ */ u3(S, { children: p3.catalog.categories.filter((c3) => byCategory2[c3.id]).map((c3) => {
      const apps = byCategory2[c3.id];
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
  var onPhone = () => document.documentElement.classList.contains("companion");
  var notOnPhone = (e3) => e3?.name === "NotOnPhone";
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
  if (!companion()) go().UpdateState().then(set).catch(() => {
  });

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
    if (onPhone()) {
      applyMotion(look);
      return;
    }
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
    const [atLogin, menu] = onPhone() ? [null, null] : await Promise.all([go().TrayAtLogin().catch(() => null), go().MenuEntry().catch(() => null)]);
    return { i: i3, atLogin, menu };
  });
  hostData.watch(drawHost);
  hostData.watch(drawHealth);
  var healthData = store(() => onPhone() ? Promise.resolve(null) : go().Health());
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
    if (i3.rootOK && !onPhone()) loadUpgrade(false);
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
    if (stepsData.error) return notOnPhone(stepsData.error) ? void 0 : showError(stepsData.error);
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
      const own2 = apps.find((a3) => a3.inputs.has(key2));
      if (own2) return own2;
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
    const named5 = new Set(pageGroups.flatMap(([, names2]) => names2));
    groups3[0].items.push(...general.filter((n2) => !named5.has(n2)));
    const cats = catalog?.categories || [];
    const catOf = (name) => (catalog?.apps || []).find((a3) => a3.kind !== "helper" && (name === a3.name || name.startsWith(a3.name + " ")))?.category || "";
    const folds = cats.map((c3) => ({ label: c3.label, pages: mine.filter((p3) => p3.name !== "Other apps" && catOf(p3.name) === c3.id).map((p3) => p3.name) })).filter((f4) => f4.pages.length);
    const loose2 = mine.filter((p3) => p3.name !== "Other apps" && !cats.some((c3) => c3.id === catOf(p3.name))).map((p3) => p3.name);
    const other = mine.some((p3) => p3.name === "Other apps") ? ["Other apps"] : [];
    navGroups = [
      ...groups3,
      { head: "Apps", items: [...loose2, ...folds, ...other, ...others.length ? [{ label: "Apps you don't have", pages: others.map((p3) => p3.name) }] : []] }
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
      const st = boardServed ? await go().StatusBoard(n2, want).catch((e3) => {
        if (!notOnPhone(e3)) throw e3;
        boardServed = false;
        return statusAlone(n2, want);
      }) : await statusAlone(n2, want);
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
  var boardServed = true;
  var singly = { watchdog: "Watchdog", alerts: "Alerts", protection: "Protection", savings: "SavingsHistory" };
  async function statusAlone(n2, want) {
    const st = await go().Status();
    for (const name of want.filter((w3) => singly[w3])) {
      go()[singly[name]]().then((data) => showCard({ board: n2, name, data }), (e3) => showCard({ board: n2, name, data: null, error: errorText(e3) }));
    }
    return st;
  }
  window.runtime?.EventsOn?.("status:card", showCard);
  function showCard(c3) {
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
    if (err) mountAlerts(card, { events: null, problem: err.message, openSetup, refresh: loadStatus });
    else mountAlerts(card, { events: events || [], openSetup, refresh: loadStatus });
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
    const parts2 = p3.split("/").filter(Boolean);
    return parts2.length > 2 ? "…/" + parts2.slice(-2).join("/") : p3;
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
    "americanexpress": { name: "American Express", bg: "#2E77BC", ink: "#ffffff", kind: "card", letters: "AX" },
    "bankofamerica": { name: "Bank of America", bg: "#012169", ink: "#ffffff", kind: "bank", path: "M15.194 7.57c.487-.163 1.047-.307 1.534-.451-1.408-.596-3.176-1.227-4.764-1.625-.253.073-1.01.271-1.534.434.541.162 2.328.577 4.764 1.642zm-8.896 6.785c.577.343 1.19.812 1.786 1.209 3.952-3.068 7.85-5.432 12.127-6.767-.596-.307-1.119-.578-1.787-.902-2.562.65-6.947 2.4-12.126 6.46zm-.758-6.46c-2.112.974-4.331 2.31-5.54 3.085.433.199.866.361 1.461.65 2.671-1.805 4.764-2.905 5.594-3.266-.595-.217-1.154-.361-1.515-.47zm8.066.234c-.686-.379-3.068-1.263-4.71-1.642-.487.18-1.173.451-1.642.65.595.162 2.815.758 4.71 1.714.487-.235 1.173-.523 1.642-.722zm-3.374 1.552c-.56-.27-1.173-.523-1.643-.74-1.425.704-3.284 1.769-5.63 3.447.505.27 1.047.595 1.624.92 1.805-1.335 3.627-2.598 5.649-3.627zm1.732 8.825c3.79-3.249 9.113-6.407 12.036-7.544a48.018 48.018 0 00-1.949-1.155c-3.771 1.246-8.174 4.007-12.108 7.129.667.505 1.371 1.028 2.02 1.57zm2.851-.235h-.108l-.18-.27h-.109v.27h-.072v-.596h.27c.055 0 .109 0 .145.036.054.019.072.073.072.127 0 .108-.09.162-.198.162zm-.289-.343c.09 0 .199.018.199-.09 0-.072-.072-.09-.144-.09h-.163v.18zm-.523.036c0-.289.235-.523.541-.523.307 0 .542.234.542.523a.543.543 0 01-.542.542.532.532 0 01-.54-.542m.107 0c0 .235.199.433.451.433a.424.424 0 100-.848c-.27 0-.45.199-.45.415" },
    "wellsfargo": { name: "Wells Fargo", bg: "#D71E28", ink: "#ffffff", kind: "bank", letters: "WF" },
    "robinhood": { name: "Robinhood", bg: "#CCFF00", ink: "#111111", kind: "investment", path: "M2.84 24h.53c.096 0 .192-.048.224-.128C7.591 13.696 11.94 8.656 14.67 5.638c.112-.128.064-.225-.096-.225h-4.88a.55.55 0 0 0-.45.225L5.746 9.972c-.514.642-.642 1.236-.642 2.086v4.43c-1.14 3.194-1.862 5.361-2.392 7.32-.032.125.016.192.129.192M20.447.646c-.754-.802-4.157-.834-5.73-.224a3 3 0 0 0-.786.465 41 41 0 0 0-3.323 3.178c-.112.113-.064.225.097.225h5.409c.497 0 .786.289.786.786v6.1c0 .16.128.208.225.064l3.258-4.254c.53-.69.69-.898.835-1.861.192-1.413.08-3.58-.77-4.479m-6.982 16.18 2.231-3.676a.7.7 0 0 0 .064-.29V6.73c0-.16-.112-.225-.224-.097-3.355 3.74-5.971 7.672-8.395 12.407-.06.12.016.225.16.177l5.009-1.54c.565-.174.882-.402 1.155-.852" },
    "discover": { name: "Discover", bg: "#FF6000", ink: "#111111", kind: "card", letters: "D" },
    "mastercard": { name: "MasterCard", bg: "#EB001B", ink: "#ffffff", kind: "card", path: "M11.343 18.031c.058.049.12.098.181.146-1.177.783-2.59 1.238-4.107 1.238C3.32 19.416 0 16.096 0 12c0-4.095 3.32-7.416 7.416-7.416 1.518 0 2.931.456 4.105 1.238-.06.051-.12.098-.165.15C9.6 7.489 8.595 9.688 8.595 12c0 2.311 1.001 4.51 2.748 6.031zm5.241-13.447c-1.52 0-2.931.456-4.105 1.238.06.051.12.098.165.15C14.4 7.489 15.405 9.688 15.405 12c0 2.31-1.001 4.507-2.748 6.031-.058.049-.12.098-.181.146 1.177.783 2.588 1.238 4.107 1.238C20.68 19.416 24 16.096 24 12c0-4.094-3.32-7.416-7.416-7.416zM12 6.174c-.096.075-.189.15-.28.231C10.156 7.764 9.169 9.765 9.169 12c0 2.236.987 4.236 2.551 5.595.09.08.185.158.28.232.096-.074.189-.152.28-.232 1.563-1.359 2.551-3.359 2.551-5.595 0-2.235-.987-4.236-2.551-5.595-.09-.08-.184-.156-.28-.231z" },
    "visa": { name: "Visa", bg: "#1A1F71", ink: "#ffffff", kind: "card", path: "M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z" },
    "apple": { name: "Apple", bg: "#000000", ink: "#ffffff", kind: "card", path: "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" },
    "goldmansachs": { name: "Goldman Sachs", bg: "#7399C6", ink: "#111111", kind: "bank", letters: "GS" },
    "paypal": { name: "PayPal", bg: "#002991", ink: "#ffffff", kind: "bank", path: "M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z" },
    "venmo": { name: "Venmo", bg: "#008CFF", ink: "#111111", kind: "bank", letters: "V" },
    "cashapp": { name: "Cash App", bg: "#00C244", ink: "#111111", kind: "bank", path: "M23.59 3.475a5.1 5.1 0 00-3.05-3.05c-1.31-.42-2.5-.42-4.92-.42H8.36c-2.4 0-3.61 0-4.9.4a5.1 5.1 0 00-3.05 3.06C0 4.765 0 5.965 0 8.365v7.27c0 2.41 0 3.6.4 4.9a5.1 5.1 0 003.05 3.05c1.3.41 2.5.41 4.9.41h7.28c2.41 0 3.61 0 4.9-.4a5.1 5.1 0 003.06-3.06c.41-1.3.41-2.5.41-4.9v-7.25c0-2.41 0-3.61-.41-4.91zm-6.17 4.63l-.93.93a.5.5 0 01-.67.01 5 5 0 00-3.22-1.18c-.97 0-1.94.32-1.94 1.21 0 .9 1.04 1.2 2.24 1.65 2.1.7 3.84 1.58 3.84 3.64 0 2.24-1.74 3.78-4.58 3.95l-.26 1.2a.49.49 0 01-.48.39H9.63l-.09-.01a.5.5 0 01-.38-.59l.28-1.27a6.54 6.54 0 01-2.88-1.57v-.01a.48.48 0 010-.68l1-.97a.49.49 0 01.67 0c.91.86 2.13 1.34 3.39 1.32 1.3 0 2.17-.55 2.17-1.42 0-.87-.88-1.1-2.54-1.72-1.76-.63-3.43-1.52-3.43-3.6 0-2.42 2.01-3.6 4.39-3.71l.25-1.23a.48.48 0 01.48-.38h1.78l.1.01c.26.06.43.31.37.57l-.27 1.37c.9.3 1.75.77 2.48 1.39l.02.02c.19.2.19.5 0 .68z" },
    "coinbase": { name: "Coinbase", bg: "#0052FF", ink: "#ffffff", kind: "investment", letters: "C" },
    "binance": { name: "Binance", bg: "#F0B90B", ink: "#111111", kind: "investment", path: "M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7154 2.7164L18.5682 12l2.6924-2.7164zm-9.272.001l2.7163 2.6914-2.7164 2.7174v-.001L9.2721 12l2.7164-2.7154zm-9.2722-.001L5.4088 12l-2.6914 2.6924L0 12l2.7164-2.7164zM11.9885.0115l7.353 7.329-2.7174 2.7154-4.6356-4.6356-4.6355 4.6595-2.7174-2.7154 7.353-7.353z" },
    "revolut": { name: "Revolut", bg: "#191C1F", ink: "#ffffff", kind: "bank", path: "M20.9133 6.9566C20.9133 3.1208 17.7898 0 13.9503 0H2.424v3.8605h10.9782c1.7376 0 3.177 1.3651 3.2087 3.043.016.84-.2994 1.633-.8878 2.2324-.5886.5998-1.375.9303-2.2144.9303H9.2322a.2756.2756 0 0 0-.2755.2752v3.431c0 .0585.018.1142.052.1612L16.2646 24h5.3114l-7.2727-10.094c3.6625-.1838 6.61-3.2612 6.61-6.9494zM6.8943 5.9229H2.424V24h4.4704z" },
    "wise": { name: "Wise", bg: "#9FE870", ink: "#111111", kind: "bank", path: "M6.488 7.469 0 15.05h11.585l1.301-3.576H7.922l3.033-3.507.01-.092L8.993 4.48h8.873l-6.878 18.925h4.706L24 .595H2.543l3.945 6.874Z" },
    "monzo": { name: "Monzo", bg: "#14233C", ink: "#ffffff", kind: "bank", path: "M4.244 1.174a.443.443 0 00-.271.13l-3.97 3.97-.001.001c3.884 3.882 8.093 8.092 11.748 11.748v-8.57L4.602 1.305a.443.443 0 00-.358-.131zm15.483 0a.443.443 0 00-.329.13L12.25 8.456v8.568L24 5.275c-1.316-1.322-2.647-2.648-3.97-3.97a.443.443 0 00-.301-.131zM0 5.979l.002 10.955c0 .294.118.577.326.785l4.973 4.976c.28.282.76.083.758-.314V12.037zm23.998.003l-6.06 6.061v10.338c-.004.399.48.6.76.314l4.974-4.976c.208-.208.326-.49.326-.785z" },
    "starlingbank": { name: "Starling Bank", bg: "#6935D3", ink: "#ffffff", kind: "bank", path: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm2.738 3.822h.666v2.724h-.666a4.794 4.794 0 0 0-4.789 4.788V12H7.226v-.666c0-4.142 3.37-7.512 7.512-7.512zM14.05 12h2.723v.666c0 4.142-3.37 7.512-7.512 7.512h-.666v-2.724h.666a4.794 4.794 0 0 0 4.789-4.788z" },
    "n26": { name: "N26", bg: "#48AC98", ink: "#111111", kind: "bank", path: "M0 3.803v1.195h7.436V3.803H0zM12.69 7.29c-2.034 0-3.038 1.252-3.038 2.684 0 .234.027.468.092.728l1.393.135a3.697 3.697 0 0 1-.09-.793c0-1.072.71-1.586 1.598-1.586.866 0 1.507.485 1.507 1.652 0 1.186-.58 1.995-1.464 2.88-.925.923-2.4 2.027-3.112 2.534v1.092h6.135v-1.195h-4.168c.695-.48 1.69-1.279 2.133-1.72.502-.503 1.931-1.794 1.931-3.636 0-1.903-1.24-2.775-2.918-2.775zm8.34 0c-1.976 0-3.454 1.517-3.454 4.916 0 3.017 1.233 4.508 3.356 4.508 1.754 0 3.068-1.198 3.068-3.172 0-1.542-.823-3.066-2.793-3.066-1.1 0-1.884.51-2.281 1.263 0-1.78.62-3.33 2.094-3.33.937 0 1.309.538 1.507 1.422l1.366-.271c-.321-1.527-1.292-2.27-2.864-2.27zM.075 7.389v9.228h1.33v-6.312c0-.56-.013-.898-.039-1.223h.026c.136.372.298.699.539 1.123l3.732 6.412h1.69V7.39H6.04v6.31c0 .56.013.898.04 1.223h-.028a7.252 7.252 0 0 0-.537-1.123L1.783 7.389H.076zm20.817 4.185c1.114 0 1.744.822 1.744 1.992 0 1.256-.717 2.034-1.701 2.034-1.09 0-1.843-1.001-1.973-2.329.33-1.133 1.063-1.697 1.93-1.697zM0 19.008v1.19h7.436v-1.19H0z" },
    "bunq": { name: "bunq", bg: "#3394D7", ink: "#111111", kind: "bank", letters: "B" },
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
    "youtube": { name: "YouTube", bg: "#FF0000", ink: "#111111", kind: "", path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
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
    "ford": { name: "Ford", bg: "#00274E", ink: "#ffffff", kind: "car", letters: "F" },
    "subaru": { name: "Subaru", bg: "#013C74", ink: "#ffffff", kind: "car", path: "M12 4.983c3.004 0 6.224.612 8.786 2.239C22.451 8.286 24 9.9 24 12.002c0 2.456-2.097 4.242-4.106 5.287-2.391 1.238-5.216 1.728-7.894 1.728-3.003 0-6.217-.605-8.78-2.238C1.556 15.714 0 14.101 0 12.003 0 9.536 2.092 7.757 4.106 6.71 6.504 5.474 9.323 4.983 12 4.983zm-.025.746c-2.793 0-5.802.523-8.225 1.983-1.524.912-3.03 2.347-3.03 4.253 0 2.239 2.04 3.806 3.864 4.706 2.258 1.102 4.897 1.53 7.391 1.53 2.798 0 5.809-.523 8.232-1.983 1.517-.918 3.029-2.346 3.029-4.253 0-2.243-2.035-3.813-3.864-4.705-2.258-1.104-4.898-1.53-7.397-1.53zm-10.54 4.686l4.597-.784 1.384-3.003L8.794 9.63l4.596.784-4.596.792-1.378 3.01-1.384-3.01zm10.106 2.289l2.028-.356.605-1.359.606 1.359 2.028.356-2.028.35-.606 1.36-.605-1.36zm4.196-3.621l2.028-.35.605-1.365.606 1.364 2.028.35-2.028.357-.606 1.36-.606-1.36zM13.57 15.51l2.02-.35.607-1.365.612 1.365 2.027.35-2.027.357-.612 1.36-.606-1.36zm-6.23.491l2.028-.35.612-1.366.605 1.366 2.028.35-2.028.357-.605 1.359-.612-1.359zm10.196-3.353l2.022-.357.605-1.359.612 1.359 2.028.357-2.028.35-.612 1.357-.606-1.357Z" },
    "mazda": { name: "Mazda", bg: "#101010", ink: "#ffffff", kind: "car", path: "M11.999 12.876c-.036 0-.105-.046-.222-.26a7.531 7.531 0 00-1.975-2.353A8.255 8.255 0 007.7 9.065a17.945 17.945 0 00-.345-.136c-1.012-.4-2.061-.813-3.035-1.377A8.982 8.982 0 014 7.362c.194-.34.42-.665.67-.962a6.055 6.055 0 011.253-1.131 7.126 7.126 0 011.618-.806c1.218-.434 2.677-.647 4.458-.649 1.783.002 3.241.215 4.459.65a7.097 7.097 0 011.619.805c.471.319.892.699 1.253 1.13.25.298.475.623.67.963-.103.064-.212.129-.32.192-.976.564-2.023.977-3.037 1.376l-.345.136a8.26 8.26 0 00-2.1 1.198 7.519 7.519 0 00-1.975 2.354c-.117.213-.187.259-.224.259m0 7.072c-1.544-.002-2.798-.129-3.83-.387-1.013-.252-1.855-.64-2.576-1.188a5.792 5.792 0 01-1.392-1.537 7.607 7.607 0 01-.81-1.768 10.298 10.298 0 01-.467-2.983c0-.674.047-1.313.135-1.901 1.106.596 2.153.895 3.08 1.16l.215.06c1.29.371 2.314.857 3.135 1.488.475.368.89.793 1.23 1.264.369.508.663 1.088.877 1.725.096.289.2.468.403.468.207 0 .308-.18.405-.468a6.124 6.124 0 012.107-2.988c.82-.632 1.845-1.118 3.135-1.489l.216-.06c.926-.265 1.973-.564 3.078-1.16.09.589.136 1.227.136 1.9 0 .458-.046 1.664-.465 2.984a7.626 7.626 0 01-.809 1.768 5.789 5.789 0 01-1.396 1.537c-.723.548-1.565.936-2.574 1.188-1.035.258-2.288.385-3.833.387m9.692-14.556c-1.909-2.05-4.99-2.99-9.692-2.995-4.7.005-7.781.944-9.69 2.994C.89 6.913 0 9.018 0 11.874c0 1.579.39 5.6 3.564 7.676 1.9 1.242 4.354 2.046 8.435 2.052 4.083-.006 6.536-.81 8.437-2.052C23.609 17.474 24 13.452 24 11.874c0-2.848-.897-4.968-2.31-6.483Z" },
    "hyundai": { name: "Hyundai", bg: "#002C5E", ink: "#ffffff", kind: "car", path: "M12 18.1622c-6.6275 0-12-2.7586-12-6.163 0-3.4028 5.3725-6.1614 12-6.1614 6.6278 0 12 2.7586 12 6.1614 0 3.4044-5.3722 6.163-12 6.163zM7.6023 7.17C3.701 7.9784.973 9.8302.973 11.9844c0 1.1929.8382 2.2932 2.248 3.1757.1174.0724.1941.0862.251.0826.1019-.006.1593-.0698.201-.146.028-.0485.0631-.1225.0972-.1968.4601-1.0834 2.0776-4.8333 4.2023-7.3758a1.1775 1.1775 0 0 0 .1048-.1461c.046-.084.0356-.1513.0006-.192-.0593-.0647-.2247-.065-.4756-.016zM9.742 8.8995c-1.1728 2.8492 1.0473 2.4961 1.6478 2.3637 1.0203-.2258 1.9944-.6128 2.7746-.925 2.2216-.8887 3.4012-1.7804 3.7925-2.123a1.9839 1.9839 0 0 0 .1076-.0988c.0557-.058.0976-.1192.0976-.2002 0-.0936-.081-.1687-.2374-.2231-.012-.0049-.0517-.021-.0641-.025-1.698-.5415-3.724-.8563-5.9016-.8563-.0168 0-.0586-.0022-.1169 0-.2608.0078-.5509.0664-.787.1888-.7777.4049-1.1163 1.4235-1.313 1.899zm10.5851.0037c-.0268.0487-.0612.1224-.0962.1974-.4599 1.0826-2.0774 4.831-4.2018 7.3733-.0515.063-.0796.1031-.1042.1467-.0492.0846-.0388.1535 0 .1935.0572.0641.2235.0654.474.0157 3.8998-.81 6.628-2.6606 6.628-4.8149 0-1.1925-.836-2.2928-2.2472-3.1745-.1161-.073-.1934-.0871-.25-.083-.1028.0067-.16.0699-.2026.1458zM14.258 15.099c1.173-2.849-1.0483-2.494-1.6467-2.3622-1.0218.225-1.996.613-2.7757.924-2.2226.8883-3.4017 1.782-3.7944 2.1234-.0468.0428-.0833.0742-.1066.0995-.0564.0573-.0967.1178-.0967.2007 0 .0923.08.1688.2362.2229.012.0048.0511.0213.0657.0255 1.696.54 3.722.8557 5.9.8557.0177 0 .0592.0016.1178 0 .2609-.0081.5522-.0677.7871-.1888.7781-.4052 1.1169-1.4234 1.3133-1.9007z" },
    "kia": { name: "Kia", bg: "#05141F", ink: "#ffffff", kind: "car", path: "M13.923 14.175c0 .046.015.072.041.072a.123.123 0 0 0 .058-.024l7.48-4.854a.72.72 0 0 1 .432-.13h1.644c.252 0 .422.168.422.42v3.139c0 .38-.084.6-.42.801l-1.994 1.2a.137.137 0 0 1-.067.024c-.024 0-.048-.019-.048-.088v-3.663c0-.043-.012-.071-.041-.071a.113.113 0 0 0-.058.024l-5.466 3.551a.733.733 0 0 1-.42.127h-3.624c-.254 0-.422-.168-.422-.422V9.757c0-.033-.015-.064-.044-.064a.118.118 0 0 0-.057.024L7.732 11.88c-.036.024-.046.041-.046.058 0 .014.008.029.032.055l2.577 2.575c.034.034.058.06.058.089 0 .024-.039.043-.084.043H7.94c-.183 0-.324-.026-.423-.125l-1.562-1.56a.067.067 0 0 0-.048-.024.103.103 0 0 0-.048.015l-2.61 1.57a.72.72 0 0 1-.423.122H.425C.168 14.7 0 14.53 0 14.279v-3.08c0-.38.084-.6.422-.8L2.43 9.192a.103.103 0 0 1 .052-.016c.032 0 .048.03.048.1V13.4c0 .043.01.063.041.063a.144.144 0 0 0 .06-.024L9.407 9.36a.733.733 0 0 1 .446-.124h3.648c.252 0 .422.168.422.42l-.002 4.518z" },
    "nissan": { name: "Nissan", bg: "#C3002F", ink: "#ffffff", kind: "car", letters: "N" },
    "chevrolet": { name: "Chevrolet", bg: "#CD9834", ink: "#111111", kind: "car", path: "M23.905 9.784H15.92V8.246a.157.157 0 00-.157-.158H8.238a.157.157 0 00-.157.158v1.538H2.358c-.087 0-.193.07-.237.158L.02 14.058c-.045.088-.011.157.077.157H8.08v1.54c0 .086.07.157.157.157h7.525c.087 0 .157-.07.157-.157v-1.54h5.723c.087 0 .193-.07.238-.157l2.1-4.116c.045-.087.011-.158-.076-.158m-2.494.996l-1.244 2.437h-5.232v1.708H9.07v-1.708H2.595L3.84 10.78h5.232V9.073h5.864v1.707z" },
    "jeep": { name: "Jeep", bg: "#000000", ink: "#ffffff", kind: "car", letters: "J" },
    "bmw": { name: "BMW", bg: "#0066B1", ink: "#ffffff", kind: "car", path: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 .78C18.196.78 23.219 5.803 23.219 12c0 6.196-5.022 11.219-11.219 11.219C5.803 23.219.781 18.196.781 12S5.804.78 12 .78zm-.678.63c-.33.014-.66.042-.992.078l-.107 2.944a9.95 9.95 0 0 1 .71-.094l.07-1.988-.013-.137.043.13.664 1.489h.606l.664-1.488.04-.131-.01.137.07 1.988c.232.022.473.054.71.094l-.109-2.944a14.746 14.746 0 0 0-.992-.078l-.653 1.625-.023.12-.023-.12-.655-1.625zm6.696 1.824l-1.543 2.428c.195.15.452.371.617.522l1.453-.754.092-.069-.069.094-.752 1.453c.163.175.398.458.53.63l2.43-1.544a16.135 16.135 0 0 0-.46-.568L18.777 6.44l-.105.092.078-.115.68-1.356-.48-.48-1.356.68-.115.078.091-.106 1.018-1.539c-.18-.152-.351-.291-.57-.46zM5.5 3.785c-.36.037-.638.283-1.393 1.125a18.97 18.97 0 0 0-.757.914l2.074 1.967c.687-.76.966-1.042 1.508-1.613.383-.405.6-.87.216-1.317-.208-.242-.558-.295-.85-.175l-.028.01.01-.026a.7.7 0 0 0-.243-.734.724.724 0 0 0-.537-.15zm.006.615c.136-.037.277.06.308.2.032.14-.056.272-.154.382-.22.25-1.031 1.098-1.031 1.098l-.402-.383c.417-.51.861-.974 1.062-1.158a.55.55 0 0 1 .217-.139zM12 4.883a7.114 7.114 0 0 0-7.08 6.388v.002a7.122 7.122 0 0 0 8.516 7.697 7.112 7.112 0 0 0 5.68-6.97A7.122 7.122 0 0 0 12 4.885v-.002zm-5.537.242c.047 0 .096.013.14.043.088.059.128.16.106.26-.026.119-.125.231-.205.318l-1.045 1.12-.42-.4s.787-.832 1.045-1.099c.102-.106.168-.17.238-.205a.331.331 0 0 1 .14-.037zM12 5.818A6.175 6.175 0 0 1 18.182 12H12v6.182A6.175 6.175 0 0 1 5.818 12H12V5.818Z" },
    "audi": { name: "Audi", bg: "#BB0A30", ink: "#ffffff", kind: "car", path: "M19.848,7.848c-0.992,0-1.902,0.348-2.616,0.928c-0.714-0.58-1.624-0.928-2.616-0.928 c-0.992,0-1.902,0.348-2.616,0.928c-0.714-0.58-1.624-0.928-2.616-0.928c-0.992,0-1.902,0.348-2.616,0.928 c-0.714-0.58-1.624-0.928-2.616-0.928C1.859,7.848,0,9.707,0,12s1.859,4.152,4.152,4.152c0.992,0,1.902-0.348,2.616-0.928 c0.714,0.58,1.624,0.928,2.616,0.928c0.992,0,1.902-0.348,2.616-0.928c0.714,0.58,1.624,0.928,2.616,0.928 c0.992,0,1.902-0.348,2.616-0.928c0.714,0.58,1.624,0.928,2.616,0.928C22.141,16.152,24,14.293,24,12S22.141,7.848,19.848,7.848z M17.232,13.866c-0.376-0.526-0.598-1.17-0.598-1.866c0-0.696,0.222-1.34,0.598-1.866c0.376,0.526,0.598,1.17,0.598,1.866 C17.83,12.696,17.608,13.34,17.232,13.866z M12,13.866c-0.376-0.526-0.598-1.17-0.598-1.866c0-0.696,0.222-1.34,0.598-1.866 c0.376,0.526,0.598,1.17,0.598,1.866C12.598,12.696,12.376,13.34,12,13.866z M6.768,13.866C6.392,13.34,6.17,12.696,6.17,12 c0-0.696,0.222-1.34,0.598-1.866C7.144,10.66,7.366,11.304,7.366,12C7.366,12.696,7.144,13.34,6.768,13.866z M0.938,12 c0-1.775,1.439-3.214,3.214-3.214c0.736,0,1.414,0.248,1.956,0.665C5.56,10.154,5.232,11.039,5.232,12 c0,0.961,0.328,1.846,0.876,2.549c-0.542,0.416-1.22,0.665-1.956,0.665C2.377,15.214,0.938,13.775,0.938,12z M7.428,14.549 C7.976,13.846,8.304,12.961,8.304,12c0-0.961-0.328-1.846-0.876-2.549c0.542-0.416,1.22-0.665,1.956-0.665 c0.736,0,1.414,0.248,1.956,0.665c-0.549,0.704-0.876,1.588-0.876,2.549c0,0.961,0.328,1.846,0.876,2.549 c-0.542,0.416-1.22,0.665-1.956,0.665C8.648,15.214,7.97,14.966,7.428,14.549z M12.66,14.549c0.549-0.704,0.876-1.588,0.876-2.549 c0-0.961-0.328-1.846-0.876-2.55c0.542-0.416,1.22-0.665,1.956-0.665s1.414,0.248,1.956,0.665 c-0.549,0.704-0.876,1.588-0.876,2.549c0,0.961,0.328,1.846,0.876,2.549c-0.542,0.416-1.22,0.665-1.956,0.665 C13.88,15.214,13.202,14.966,12.66,14.549z M19.848,15.214c-0.736,0-1.414-0.248-1.956-0.665c0.548-0.704,0.876-1.588,0.876-2.549 c0-0.961-0.328-1.846-0.876-2.549c0.542-0.416,1.22-0.665,1.956-0.665c1.775,0,3.214,1.439,3.214,3.214 S21.623,15.214,19.848,15.214z" },
    "volkswagen": { name: "Volkswagen", bg: "#151F5D", ink: "#ffffff", kind: "car", path: "M12 0C5.36 0 0 5.36 0 12S5.36 24 12 24 24 18.64 24 12 18.64 0 12 0M12 1.41C13.2 1.41 14.36 1.63 15.43 2L12.13 9.13C12.09 9.17 12.09 9.26 12 9.26S11.91 9.17 11.87 9.13L8.57 2C9.64 1.63 10.8 1.42 12 1.42M6.9 2.74L10.72 10.97C10.8 11.14 10.89 11.19 11 11.19H13C13.12 11.19 13.2 11.14 13.29 10.97L17.06 2.74C18.64 3.64 20 4.93 20.96 6.47L15.6 16.84C15.56 16.93 15.5 16.97 15.47 16.97C15.39 16.97 15.39 16.89 15.34 16.84L13.29 12.3C13.2 12.13 13.12 12.09 13 12.09H11C10.89 12.09 10.8 12.13 10.71 12.3L8.66 16.84C8.61 16.89 8.62 16.97 8.53 16.97C8.44 16.97 8.44 16.89 8.4 16.84L3 6.47C3.94 4.93 5.32 3.64 6.9 2.74M2.06 8.53L8.23 20.53C8.31 20.7 8.4 20.83 8.62 20.83C8.83 20.83 8.91 20.7 9 20.53L11.87 14.14C11.91 14.06 11.96 14 12 14C12.09 14 12.09 14.1 12.13 14.14L15.04 20.53C15.13 20.7 15.21 20.83 15.43 20.83C15.64 20.83 15.73 20.7 15.81 20.53L22 8.53C22.37 9.6 22.59 10.76 22.59 12C22.54 17.79 17.79 22.59 12 22.59C6.21 22.59 1.46 17.79 1.46 12C1.46 10.8 1.67 9.65 2.06 8.53Z" },
    "volvo": { name: "Volvo", bg: "#003057", ink: "#ffffff", kind: "car", path: "M10.873 12.584h.49l-.001-1.452h-.489v-.322h1.94v.322h-.483v1.451h.449c.415 0 .687-.274.687-.646h.32v.972h-2.913v-.325zm4.313.327h1.134l.962-1.779h.482v-.322h-1.45v.322h.419l-.701 1.295-.71-1.295h.51l-.002-.322h-2.104v.322h.482l.978 1.779zM5.073 10.81H2.968v.322h.481l.98 1.779h1.133l.962-1.779h.482v-.322h-1.45v.322h.418l-.7 1.295-.71-1.295h.509v-.322zm3.707-.044c.975 0 1.498.486 1.498 1.096 0 .618-.494 1.111-1.493 1.111-.999 0-1.497-.493-1.497-1.111 0-.61.517-1.096 1.492-1.096zm.017.33c-.333-.005-.527.348-.534.753-.006.39.15.784.506.79.366.007.524-.39.53-.772.008-.405-.168-.764-.502-.77zm10.738-.33c.974 0 1.497.486 1.497 1.096 0 .618-.493 1.111-1.492 1.111-1 0-1.498-.493-1.498-1.111 0-.61.518-1.096 1.493-1.096zm-.517 1.083c-.007.39.15.784.506.79.366.007.524-.39.53-.772.008-.405-.168-.764-.502-.77-.333-.006-.527.347-.534.752zm2.857-6.667L20.656 6.4A10.26 10.26 0 0 1 22.308 12c0 5.693-4.615 10.308-10.308 10.308S1.692 17.693 1.692 12 6.307 1.692 12 1.692c2.07 0 3.996.61 5.611 1.66l1.219-1.219A11.944 11.944 0 0 0 12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12c0-2.533-.785-4.882-2.125-6.818zM18.036.472v.337c.728.394 1.413.859 2.047 1.382l-1.71 1.71a10.29 10.29 0 0 1 1.735 1.732l1.708-1.708c.524.636.989 1.322 1.384 2.038h.328V.473h-5.492z" },
    // Initials on the brand's colour where simple-icons has no mark: brokers, banks, and bills.
    "fidelity": { name: "Fidelity", bg: "#368727", ink: "#ffffff", kind: "investment", letters: "F" },
    "vanguard": { name: "Vanguard", bg: "#96151D", ink: "#ffffff", kind: "investment", letters: "V" },
    "schwab": { name: "Charles Schwab", bg: "#00A0DF", ink: "#111111", kind: "investment", letters: "S" },
    "etrade": { name: "E*TRADE", bg: "#5627D8", ink: "#ffffff", kind: "investment", letters: "E" },
    "interactivebrokers": { name: "Interactive Brokers", bg: "#D81222", ink: "#ffffff", kind: "investment", letters: "IB" },
    "traderepublic": { name: "Trade Republic", bg: "#000000", ink: "#ffffff", kind: "investment", letters: "TR" },
    "capitalone": { name: "Capital One", bg: "#004977", ink: "#ffffff", kind: "bank", letters: "C1" },
    "citi": { name: "Citi", bg: "#056DAE", ink: "#ffffff", kind: "bank", letters: "C" },
    "usbank": { name: "U.S. Bank", bg: "#0C2074", ink: "#ffffff", kind: "bank", letters: "US" },
    "sofi": { name: "SoFi", bg: "#00A9CE", ink: "#111111", kind: "bank", letters: "S" },
    "navyfederal": { name: "Navy Federal", bg: "#003B71", ink: "#ffffff", kind: "bank", letters: "NF" },
    "usaa": { name: "USAA", bg: "#002F6C", ink: "#ffffff", kind: "bank", letters: "U" },
    "mtbank": { name: "M&T Bank", bg: "#00704A", ink: "#ffffff", kind: "bank", letters: "MT" },
    "redstone": { name: "Redstone Federal Credit Union", bg: "#00573F", ink: "#ffffff", kind: "bank", letters: "R" },
    "disneyplus": { name: "Disney+", bg: "#113CCF", ink: "#ffffff", kind: "", letters: "D+" },
    "hulu": { name: "Hulu", bg: "#1CE783", ink: "#111111", kind: "", letters: "H" },
    "peacock": { name: "Peacock", bg: "#000000", ink: "#ffffff", kind: "", letters: "P" },
    "amazonprime": { name: "Amazon Prime", bg: "#00A8E1", ink: "#111111", kind: "", letters: "P" },
    "amazonprimevideo": { name: "Amazon Prime Video", bg: "#00A8E1", ink: "#111111", kind: "", letters: "PV" },
    "appletv": { name: "Apple TV", bg: "#000000", ink: "#ffffff", kind: "", path: "M20.57 17.735h-1.815l-3.34-9.203h1.633l2.02 5.987c.075.231.273.9.586 2.012l.297-.997.33-1.006 2.094-6.004H24zm-5.344-.066a5.76 5.76 0 0 1-1.55.207c-1.23 0-1.84-.693-1.84-2.087V9.646h-1.063V8.532h1.121V7.081l1.476-.602v2.062h1.707v1.113H13.38v5.805c0 .446.074.75.214.932.14.182.396.264.75.264.207 0 .495-.041.883-.115zm-7.29-5.343c.017 1.764 1.55 2.358 1.567 2.366-.017.042-.248.842-.808 1.658-.487.71-.99 1.418-1.79 1.435-.783.016-1.03-.462-1.93-.462-.89 0-1.17.445-1.913.478-.758.025-1.344-.775-1.838-1.484-.998-1.451-1.765-4.098-.734-5.88.51-.89 1.426-1.451 2.416-1.46.75-.016 1.468.512 1.93.512.461 0 1.327-.627 2.234-.536.38.016 1.452.157 2.136 1.154-.058.033-1.278.743-1.27 2.219M6.468 7.988c.404-.495.685-1.18.61-1.864-.585.025-1.294.388-1.723.883-.38.437-.71 1.138-.619 1.806.652.05 1.328-.338 1.732-.825Z" },
    "applemusic": { name: "Apple Music", bg: "#FA243C", ink: "#111111", kind: "", path: "M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 011.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 00.02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 00-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066-.76.15-1.52.303-2.28.456l-2.325.47-1.374.278c-.016.003-.032.01-.048.013-.277.077-.377.203-.39.49-.002.042 0 .086 0 .13-.002 2.602 0 5.204-.003 7.805 0 .42-.047.836-.215 1.227-.278.64-.77 1.04-1.434 1.233-.35.1-.71.16-1.075.172-.96.036-1.755-.6-1.92-1.544-.14-.812.23-1.685 1.154-2.075.357-.15.73-.232 1.108-.31.287-.06.575-.116.86-.177.383-.083.583-.323.6-.714v-.15c0-2.96 0-5.922.002-8.882 0-.123.013-.25.042-.37.07-.285.273-.448.546-.518.255-.066.515-.112.774-.165.733-.15 1.466-.296 2.2-.444l2.27-.46c.67-.134 1.34-.27 2.01-.403.22-.043.442-.088.663-.106.31-.025.523.17.554.482.008.073.012.148.012.223.002 1.91.002 3.822 0 5.732z" },
    "icloud": { name: "iCloud", bg: "#3693F3", ink: "#111111", kind: "", path: "M13.762 4.29a6.51 6.51 0 0 0-5.669 3.332 3.571 3.571 0 0 0-1.558-.36 3.571 3.571 0 0 0-3.516 3A4.918 4.918 0 0 0 0 14.796a4.918 4.918 0 0 0 4.92 4.914 4.93 4.93 0 0 0 .617-.045h14.42c2.305-.272 4.041-2.258 4.043-4.589v-.009a4.594 4.594 0 0 0-3.727-4.508 6.51 6.51 0 0 0-6.511-6.27z" },
    "googleone": { name: "Google One", bg: "#4285F4", ink: "#111111", kind: "", letters: "G1" },
    "microsoft365": { name: "Microsoft 365", bg: "#D83B01", ink: "#ffffff", kind: "", letters: "M" },
    "tmobile": { name: "T-Mobile", bg: "#E20074", ink: "#ffffff", kind: "", letters: "T" },
    "atandt": { name: "AT&T", bg: "#009FDB", ink: "#111111", kind: "", path: "M4.584 21.438a12.077 12.077 0 0 0 7.349 2.495 12 12 0 0 0 7.887-2.967c-.944.607-3.64 2.023-7.887 2.023-3.708 0-6.068-.81-7.349-1.55m8.158.606c2.966 0 6.202-.809 8.09-2.427.539-.405 1.01-1.011 1.483-1.753.27-.472.539-1.011.741-1.483-1.82 2.63-7.011 4.315-12.404 4.315-3.776 0-7.888-1.214-9.506-3.573 1.483 3.236 6 4.92 11.596 4.92m-3.236-5.257C3.37 16.787.472 13.955 0 12c0 .674.067 1.483.202 2.09.068.27.27.674.607 1.079 1.483 1.55 5.191 3.707 11.595 3.707 8.697 0 10.72-2.898 11.124-3.842.27-.674.472-1.888.472-2.967v-.674c-.607 2.292-8.022 5.394-14.494 5.394m-8.427-9.91C.742 7.55.337 8.763.202 9.37c-.067.27 0 .404.068.607.741 1.55 4.45 4.044 13.078 4.044 5.259 0 9.371-1.28 10.045-3.64.135-.404.135-.876 0-1.483-.202-.674-.472-1.483-.809-2.09.068 3.101-8.562 5.124-12.944 5.124-4.719 0-8.696-1.888-8.696-4.248.067-.337.135-.606.135-.809M19.82 3.034c.068.067.068.135.068.27 0 1.348-4.045 3.64-10.517 3.64-4.787 0-5.663-1.753-5.663-2.9 0-.404.135-.808.472-1.213-.607.607-1.146 1.147-1.686 1.82-.202.27-.337.54-.337.675 0 2.36 5.865 3.977 11.259 3.977 5.797 0 8.427-1.887 8.427-3.573 0-.606-.203-.943-.81-1.618a17.301 17.301 0 0 0-1.213-1.078m-1.753-1.281A11.794 11.794 0 0 0 11.933.067C9.64.067 7.55.674 5.73 1.82c-.539.27-.876.54-.876.877 0 1.01 2.36 2.09 6.54 2.09 4.112 0 7.348-1.214 7.348-2.36.067-.202-.203-.405-.675-.674" },
    "xfinity": { name: "Xfinity", bg: "#6138F5", ink: "#ffffff", kind: "", letters: "X" },
    "progressive": { name: "Progressive", bg: "#0E6EB8", ink: "#ffffff", kind: "", letters: "P" },
    "visiblebyverizon": { name: "Visible by Verizon", bg: "#1800FF", ink: "#ffffff", kind: "", letters: "V" },
    "mintmobile": { name: "Mint Mobile", bg: "#67B05B", ink: "#111111", kind: "", letters: "M" },
    "googlefi": { name: "Google Fi", bg: "#4285F4", ink: "#111111", kind: "", letters: "Fi" },
    "usmobile": { name: "US Mobile", bg: "#2F80ED", ink: "#111111", kind: "", letters: "US" },
    "boostmobile": { name: "Boost Mobile", bg: "#F7941D", ink: "#111111", kind: "", letters: "B" },
    "costco": { name: "Costco", bg: "#005DAA", ink: "#ffffff", kind: "", letters: "C" },
    "walmart": { name: "Walmart", bg: "#0071CE", ink: "#ffffff", kind: "", letters: "W" },
    "amazon": { name: "Amazon", bg: "#FF9900", ink: "#111111", kind: "", letters: "A" },
    "kohls": { name: "Kohl's", bg: "#000000", ink: "#ffffff", kind: "", letters: "K" },
    "audible": { name: "Audible", bg: "#F8991C", ink: "#111111", kind: "", path: "M12.008 17.362L24 9.885v2.028l-11.992 7.509L0 11.912V9.886l12.008 7.477zm0-9.378c-2.709 0-5.085 1.363-6.448 3.47.111-.111.175-.175.286-.254 3.374-2.804 8.237-2.17 10.883 1.362l1.758-1.124c-1.394-2.044-3.786-3.454-6.48-3.454m0 3.47a4.392 4.392 0 0 0-3.548 1.821 3.597 3.597 0 0 1 2.139-.697c1.299 0 2.455.666 3.232 1.79l1.679-1.045c-.729-1.157-2.028-1.87-3.501-1.87M3.897 8.412c4.943-3.897 11.929-2.836 15.652 2.344l.031.032 1.822-1.125a11.214 11.214 0 0 0-9.394-5.085c-3.897 0-7.366 1.996-9.394 5.085.364-.412.824-.903 1.283-1.251" },
    "crunchyroll": { name: "Crunchyroll", bg: "#FF5E00", ink: "#111111", kind: "", path: "M2.909 13.436C2.914 7.61 7.642 2.893 13.468 2.898c5.576.005 10.137 4.339 10.51 9.819q.021-.351.022-.706C24.007 5.385 18.64.006 12.012 0S.007 5.36 0 11.988 5.36 23.994 11.988 24q.412 0 .815-.027c-5.526-.338-9.9-4.928-9.894-10.538Zm16.284.155a4.1 4.1 0 0 1-4.095-4.103 4.1 4.1 0 0 1 2.712-3.855 8.95 8.95 0 0 0-4.187-1.037 9.007 9.007 0 1 0 8.997 9.016q-.001-.847-.15-1.651a4.1 4.1 0 0 1-3.278 1.63Z" },
    "fubotv": { name: "FuboTV", bg: "#FA4616", ink: "#111111", kind: "", letters: "F" },
    "tidal": { name: "Tidal", bg: "#000000", ink: "#ffffff", kind: "", path: "M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996 4.004 12l4.004-4.004L12.012 12l-4.004 4.004 4.004 4.004 4.004-4.004L12.012 12l4.004-4.004-4.004-4.004zM16.042 7.996l3.979-3.979L24 7.996l-3.979 3.979z" },
    "pandora": { name: "Pandora", bg: "#224099", ink: "#ffffff", kind: "", path: "M1.882 0v24H8.32a1.085 1.085 0 001.085-1.085v-4.61h1.612c7.88 0 11.103-4.442 11.103-9.636C22.119 2.257 17.247 0 12.662 0H1.882Z" },
    "deezer": { name: "Deezer", bg: "#A238FF", ink: "#ffffff", kind: "", path: "M.693 10.024c.381 0 .693-1.256.693-2.807 0-1.55-.312-2.807-.693-2.807C.312 4.41 0 5.666 0 7.217s.312 2.808.693 2.808ZM21.038 1.56c-.364 0-.684.805-.91 2.096C19.765 1.446 19.184 0 18.526 0c-.78 0-1.464 2.036-1.784 5-.312-2.158-.788-3.536-1.325-3.536-.745 0-1.386 2.704-1.62 6.472-.442-1.932-1.083-3.145-1.793-3.145s-1.35 1.213-1.793 3.145c-.242-3.76-.874-6.463-1.628-6.463-.537 0-1.013 1.378-1.325 3.535C6.938 2.036 6.262 0 5.474 0c-.658 0-1.247 1.447-1.602 3.665-.217-1.291-.546-2.105-.91-2.105-.675 0-1.221 2.807-1.221 6.272 0 3.466.546 6.273 1.221 6.273.277 0 .537-.476.736-1.273.32 2.928.996 4.938 1.776 4.938.606 0 1.143-1.204 1.507-3.11.251 3.622.875 6.195 1.602 6.195.46 0 .875-1.023 1.187-2.677C10.142 21.6 11 24 12.004 24c1.005 0 1.863-2.4 2.235-5.822.312 1.654.727 2.677 1.186 2.677.728 0 1.352-2.573 1.603-6.195.364 1.906.9 3.11 1.507 3.11.78 0 1.455-2.01 1.775-4.938.208.797.46 1.273.737 1.273.675 0 1.22-2.807 1.22-6.273-.008-3.457-.553-6.272-1.23-6.272ZM23.307 10.024c.381 0 .693-1.256.693-2.807 0-1.55-.312-2.807-.693-2.807-.381 0-.693 1.256-.693 2.807s.312 2.808.693 2.808Z" },
    "amazonmusic": { name: "Amazon Music", bg: "#25D1DA", ink: "#111111", kind: "", letters: "M" },
    "dropbox": { name: "Dropbox", bg: "#0061FF", ink: "#ffffff", kind: "", path: "M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" },
    "backblaze": { name: "Backblaze", bg: "#E21E29", ink: "#ffffff", kind: "", path: "M9.3108.0003c.6527 1.3502 1.5666 4.0812-1.3887 7.1738-1.8096 1.8796-3.078 3.8487-2.3496 6.0644.3642 1.1037 1.1864 2.5079 2.8867 2.7852.6107.1008 1.3425-.0006 1.7403-.1406 2.4538-.8544 2.098-3.4138 1.5546-5.0469-.07-.2129-.1915-.7333-.2363-.9238-.3726-1.6023.776-2.6562 1.129-3.8047.028-.0925.0534-.1819.0702-.2715.042-.21.067-.423.0781-.6387 0-1.8264-.9882-2.6303-1.7754-3.5996C10.1794.5643 9.3107.0003 9.3107.0003Zm6.2754 6.0175s-.709.3366-1.2188.8829c-.4454.4818-.8635.8789-1.2949 1.8593-.028.14-.0518.2863-.0742.4375-.2325 1.6416 1.1473 3.1446.7187 5.1895-.112.535-.3554.7123-.7812 1.6367-.5098 1.1065-.383 2.588.3594 3.5293.6723.8488 1.879 1.2321 3.0527.9492 2.1065-.5042 3.0646-2.2822 2.8965-4.2851-.1317-1.58-.8154-2.7536-2.754-4.961-.9607-1.0925-1.6072-2.409-1.5624-3.4062.1373-1.2074.6582-1.832.6582-1.832zM4.8928 15.1936c-.0222.0145-.0439.0614-.0586.1602a.0469.0469 0 0 1-.0059.0195v.01c-.1148.5406-.1649 1.823.1153 2.9687.353 1.4427 1.4175 3.902 4.412 5.129 2.5184 1.0336 5.718.5411 7.8497-1.627.5294-.5435.408-.4897-.4883-.2012v-.002c-1.1121.3558-3.5182.5463-4.7676-1-1.5239-1.8852-.4302-3.3633-1.3574-3.1504-3.6164.8348-5.2667-1.4657-5.5469-2.1016-.0023-.002-.0857-.2487-.1523-.205z" },
    "1password": { name: "1Password", bg: "#145FE4", ink: "#ffffff", kind: "", path: "M12 0c6.627 0 12 5.373 12 12 0 6.628-5.373 12-12 12S0 18.628 0 12C0 5.373 5.373 0 12 0m-.893 4.86c-.485 0-.727.001-.913.095a.87.87 0 0 0-.378.379c-.094.185-.095.428-.095.912v2.747c0 .12 0 .182.016.238q.02.075.065.138a1 1 0 0 0 .175.162l.695.564c.113.092.17.139.19.194a.22.22 0 0 1 0 .15c-.02.056-.077.102-.19.194l-.695.564a1 1 0 0 0-.175.162.4.4 0 0 0-.065.138 1 1 0 0 0-.016.238v6.019c0 .485 0 .728.095.913a.87.87 0 0 0 .378.378c.186.094.428.094.913.094h1.786c.485 0 .727 0 .913-.094a.87.87 0 0 0 .378-.378c.095-.185.095-.428.095-.913v-2.747c0-.12 0-.182-.016-.238a.4.4 0 0 0-.065-.138 1 1 0 0 0-.175-.162l-.695-.564c-.113-.092-.17-.138-.191-.193a.22.22 0 0 1 0-.152c.02-.055.078-.1.19-.193l.696-.564a1 1 0 0 0 .175-.162.4.4 0 0 0 .065-.138 1 1 0 0 0 .016-.238V6.246c0-.484 0-.727-.095-.912a.87.87 0 0 0-.378-.379c-.186-.094-.428-.094-.913-.094Z" },
    "chatgpt": { name: "ChatGPT", bg: "#10A37F", ink: "#111111", kind: "", letters: "AI" },
    "claude": { name: "Claude", bg: "#D97757", ink: "#111111", kind: "", path: "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" },
    "xboxgamepass": { name: "Xbox Game Pass", bg: "#107C10", ink: "#ffffff", kind: "", letters: "X" },
    "playstation": { name: "PlayStation", bg: "#0070D1", ink: "#ffffff", kind: "", path: "M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.39-1.502zm4.656 16.241l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.205 1.5V14.98l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661 1.848.601 2.04 1.472 1.576 2.072-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107V18.86zM1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073-1.939.331-3.996.196-6.038-.479z" },
    "nintendoswitch": { name: "Nintendo Switch", bg: "#E60012", ink: "#ffffff", kind: "", letters: "N" },
    "strava": { name: "Strava", bg: "#FC4C02", ink: "#111111", kind: "", path: "M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" },
    "patreon": { name: "Patreon", bg: "#000000", ink: "#ffffff", kind: "", path: "M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604C2.357 3.231 1.093 7.391 1.046 11.54c-.039 3.411.302 12.396 5.369 12.46 3.765.047 4.326-4.804 6.068-7.141 1.24-1.662 2.836-2.132 4.801-2.618 3.376-.836 5.678-3.501 5.673-7.031Z" },
    "thenewyorktimes": { name: "The New York Times", bg: "#000000", ink: "#ffffff", kind: "", letters: "T" },
    "ring": { name: "Ring", bg: "#1C9AD6", ink: "#111111", kind: "", path: "M24 16.375a3.05 3.05 0 0 1-.246 1.231 3.114 3.114 0 0 1-1.672 1.66 3.068 3.068 0 0 1-1.225.247 3.695 3.695 0 0 1-.71-.073 4.05 4.05 0 0 1-.739-.218 3.184 3.184 0 0 1-.676-.37 2.02 2.02 0 0 1-.507-.515.46.46 0 0 1-.08-.275.442.442 0 0 1 .152-.346.504.504 0 0 1 .346-.138.553.553 0 0 1 .201.04.392.392 0 0 1 .186.17.046.046 0 0 0 .016.032l.064.065a1.806 1.806 0 0 0 .798.507 3.052 3.052 0 0 0 .943.154 2.12 2.12 0 0 0 .846-.17 2.189 2.189 0 0 0 1.16-1.16 2.115 2.115 0 0 0 .176-.841v-1.109a3.132 3.132 0 0 1-.985.637 3.089 3.089 0 0 1-1.193.234 3.046 3.046 0 0 1-1.231-.246 3.137 3.137 0 0 1-1.66-1.66 3.04 3.04 0 0 1-.247-1.232v-2.544a3.058 3.058 0 0 1 .247-1.225 3.154 3.154 0 0 1 .668-1 3.202 3.202 0 0 1 .986-.669 3.15 3.15 0 0 1 2.463 0 3.09 3.09 0 0 1 1.668 1.668 3.066 3.066 0 0 1 .246 1.225v5.92zm-.967-5.92a2.118 2.118 0 0 0-.17-.846 2.189 2.189 0 0 0-1.16-1.16 2.201 2.201 0 0 0-1.692 0 2.191 2.191 0 0 0-1.166 1.16 2.134 2.134 0 0 0-.168.845v2.531a2.133 2.133 0 0 0 .168.853 2.194 2.194 0 0 0 .468.693 2.171 2.171 0 0 0 .694.467 2.201 2.201 0 0 0 1.692 0 2.189 2.189 0 0 0 1.16-1.16 2.117 2.117 0 0 0 .174-.853zm-7.252 5.356a.435.435 0 0 1-.154.363.511.511 0 0 1-.66 0 .434.434 0 0 1-.153-.363v-5.356a2.118 2.118 0 0 0-.17-.846 2.189 2.189 0 0 0-1.16-1.16 2.201 2.201 0 0 0-1.692 0 2.19 2.19 0 0 0-1.16 1.16 2.127 2.127 0 0 0-.17.846v5.356a.434.434 0 0 1-.152.363.511.511 0 0 1-.661 0 .434.434 0 0 1-.153-.363v-5.356a3.058 3.058 0 0 1 .246-1.225 3.163 3.163 0 0 1 .67-1 3.202 3.202 0 0 1 .984-.669 3.15 3.15 0 0 1 2.464 0 3.091 3.091 0 0 1 1.667 1.668 3.066 3.066 0 0 1 .247 1.225zm-8.383 0a.435.435 0 0 1-.152.363.511.511 0 0 1-.662 0 .434.434 0 0 1-.152-.363V7.956a.435.435 0 0 1 .152-.363.512.512 0 0 1 .662 0 .436.436 0 0 1 .152.363zM4.982 8.44a.463.463 0 0 1-.145.338.483.483 0 0 1-.355.142.503.503 0 0 1-.339-.145l-.016-.017a.149.149 0 0 0-.032-.024.123.123 0 0 1-.033-.025 1.9 1.9 0 0 0-1.24-.43q-.871 0-1.363.595-.491.596-.492 1.693v5.243a.435.435 0 0 1-.153.363.525.525 0 0 1-.33.123.525.525 0 0 1-.33-.123.434.434 0 0 1-.153-.363v-5.243A4.362 4.362 0 0 1 .18 9.303a3.034 3.034 0 0 1 .53-1.031 2.546 2.546 0 0 1 .878-.706 2.763 2.763 0 0 1 1.231-.257 3.08 3.08 0 0 1 1.065.209 2.573 2.573 0 0 1 .934.58.48.48 0 0 1 .163.343zm2.76-3.128a.826.826 0 0 1-.826.827.826.826 0 0 1-.827-.827.826.826 0 0 1 .827-.826.826.826 0 0 1 .826.826Z" },
    "nordvpn": { name: "NordVPN", bg: "#4687FF", ink: "#111111", kind: "", path: "M2.2838 21.5414A11.9866 11.9866 0 010 14.4832C0 7.8418 5.3727 2.4586 12 2.4586c6.6279 0 12 5.3832 12 12.0246a11.9853 11.9853 0 01-2.2838 7.0582l-5.7636-9.3783-.5565.9419.5645 2.6186L12 8.9338l-2.45 4.1447.5707 2.6451-2.0764-3.5555-5.7605 9.3733z" },
    "proton": { name: "Proton", bg: "#6D4AFF", ink: "#ffffff", kind: "", path: "M2.474 17.75V24h4.401v-5.979c0-.582.232-1.14.645-1.551a2.204 2.204 0 0 1 1.556-.643h4.513a7.955 7.955 0 0 0 5.612-2.318 7.907 7.907 0 0 0 2.325-5.595 7.91 7.91 0 0 0-2.325-5.596A7.958 7.958 0 0 0 13.587 0H2.474v7.812h4.401V4.129h6.416c.995 0 1.951.394 2.656 1.097.704.7 1.1 1.653 1.101 2.646a3.742 3.742 0 0 1-1.101 2.648 3.766 3.766 0 0 1-2.656 1.097H8.627a6.158 6.158 0 0 0-4.352 1.795 6.133 6.133 0 0 0-1.801 4.338Z" },
    "uber": { name: "Uber", bg: "#000000", ink: "#ffffff", kind: "", letters: "U" },
    "lyft": { name: "Lyft", bg: "#FF00BF", ink: "#111111", kind: "", path: "M4.38 15.883c.036.042.125.135.125.135s-.094.059-.152.086a3.046 3.046 0 0 1-1.28.286C1.593 16.39 0 15.29 0 12.878v-8.78h3.512v9.365c0 .95.306 1.781.867 2.42zM24 11.122V7.61h-1.253c-.524-2.76-3.425-4.574-6.341-3.484-1.624.607-2.943 2.548-2.943 4.282v7.979a1608.8 1608.8 0 0 0 .153 0 3.495 3.495 0 0 0 2.38-1.077c.632-.658.98-1.522.98-2.432h1.463V9.366h-1.463V8.4c0-.375.198-.726.526-.909.9-.5 1.815.143 1.815.996v3.22c0 1.273.48 2.456 1.354 3.329a4.666 4.666 0 0 0 3.178 1.351H24v-3.51a1.17 1.17 0 0 1-1.17-1.17v-.586H24zm-14.927 1.17a.585.585 0 0 1-1.17 0V7.61H4.39v5.853a2.928 2.928 0 0 0 4.83 2.224c-.055.433-.294.792-.69 1.04-.373.234-.857.357-1.402.357a3.83 3.83 0 0 1-1.65-.382s-.093-.044-.21-.11v3.119a6.65 6.65 0 0 0 2.468.484c1.312 0 2.51-.41 3.371-1.155.967-.836 1.478-2.056 1.478-3.528V7.61H9.073v4.683z" },
    "doordash": { name: "DoorDash", bg: "#FF3008", ink: "#111111", kind: "", path: "M23.071 8.409a6.09 6.09 0 00-5.396-3.228H.584A.589.589 0 00.17 6.184L3.894 9.93a1.752 1.752 0 001.242.516h12.049a1.554 1.554 0 11.031 3.108H8.91a.589.589 0 00-.415 1.003l3.725 3.747a1.75 1.75 0 001.242.516h3.757c4.887 0 8.584-5.225 5.852-10.413" },
    "irs": { name: "IRS", bg: "#0D4C92", ink: "#ffffff", kind: "", letters: "IRS" },
    "ynab": { name: "YNAB", bg: "#3B5EDA", ink: "#ffffff", kind: "", letters: "Y" },
    "googleplay": { name: "Google Play", bg: "#414141", ink: "#ffffff", kind: "", path: "M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" },
    "appstore": { name: "App Store", bg: "#0D96F6", ink: "#111111", kind: "", path: "M8.8086 14.9194l6.1107-11.0368c.0837-.1513.1682-.302.2437-.4584.0685-.142.1267-.2854.1646-.4403.0803-.3259.0588-.6656-.066-.9767-.1238-.3095-.3417-.5678-.6201-.7355a1.4175 1.4175 0 0 0-.921-.1924c-.3207.043-.6135.1935-.8443.4288-.1094.1118-.1996.2361-.2832.369-.092.1463-.175.2979-.259.4492l-.3864.6979-.3865-.6979c-.0837-.1515-.1667-.303-.2587-.4492-.0837-.1329-.1739-.2572-.2835-.369-.2305-.2353-.5233-.3857-.844-.429a1.4181 1.4181 0 0 0-.921.1926c-.2784.1677-.4964.426-.6203.7355-.1246.311-.1461.6508-.066.9767.038.155.0962.2984.1648.4403.0753.1564.1598.307.2437.4584l1.248 2.2543-4.8625 8.7825H2.0295c-.1676 0-.3351-.0007-.5026.0092-.1522.009-.3004.0284-.448.0714-.3108.0906-.5822.2798-.7783.548-.195.2665-.3006.5929-.3006.9279 0 .3352.1057.6612.3006.9277.196.2683.4675.4575.7782.548.1477.043.296.0623.4481.0715.1675.01.335.009.5026.009h13.0974c.0171-.0357.059-.1294.1-.2697.415-1.4151-.6156-2.843-2.0347-2.843zM3.113 18.5418l-.7922 1.5008c-.0818.1553-.1644.31-.2384.4705-.067.1458-.124.293-.1611.452-.0785.3346-.0576.6834.0645 1.0029.1212.3175.3346.583.607.7549.2727.172.5891.2416.9013.1975.3139-.044.6005-.1986.8263-.4402.1072-.1148.1954-.2424.2772-.3787.0902-.1503.1714-.3059.2535-.4612L6 19.4636c-.0896-.149-.9473-1.4704-2.887-.9218m20.5861-3.0056a1.4707 1.4707 0 0 0-.779-.5407c-.1476-.0425-.2961-.0616-.4483-.0705-.1678-.0099-.3352-.0091-.503-.0091H18.648l-4.3891-7.817c-.6655.7005-.9632 1.485-1.0773 2.1976-.1655 1.0333.0367 2.0934.546 3.0004l5.2741 9.3933c.084.1494.167.299.2591.4435.0837.131.1739.2537.2836.364.231.2323.5238.3809.8449.4232.3192.0424.643-.0244.9217-.1899.2784-.1653.4968-.4204.621-.7257.1246-.3072.146-.6425.0658-.9641-.0381-.1529-.0962-.2945-.165-.4346-.0753-.1543-.1598-.303-.2438-.4524l-1.216-2.1662h1.596c.1677 0 .3351.0009.5029-.009.1522-.009.3007-.028.4483-.0705a1.4707 1.4707 0 0 0 .779-.5407A1.5386 1.5386 0 0 0 24 16.452a1.539 1.539 0 0 0-.3009-.9158Z" },
    // The homelab's own bills: servers, domains, VPNs, and the services beside it.
    "plex": { name: "Plex", bg: "#EBAF00", ink: "#111111", kind: "", letters: "P" },
    "tailscale": { name: "Tailscale", bg: "#242424", ink: "#ffffff", kind: "", path: "M24 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-9 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm0-9a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6-6a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 24a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm18 .5a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm9-9a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-3 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 3a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM3 5.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
    "cloudflare": { name: "Cloudflare", bg: "#F38020", ink: "#111111", kind: "", path: "M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727" },
    "hetzner": { name: "Hetzner", bg: "#D50C2D", ink: "#ffffff", kind: "", path: "M0 0v24h24V0H0zm4.602 4.025h2.244c.509 0 .716.215.716.717v5.64h8.883v-5.64c0-.509.215-.717.717-.717h2.229c.5 0 .71.23.724.717v14.516c0 .509-.215.717-.717.717h-2.23c-.51 0-.717-.215-.717-.717v-5.735H7.562v5.735c0 .516-.215.717-.716.717H4.602c-.51 0-.717-.208-.717-.717V4.742c0-.509.207-.717.717-.717z" },
    "digitalocean": { name: "DigitalOcean", bg: "#0080FF", ink: "#111111", kind: "", path: "M12.04 0C5.408-.02.005 5.37.005 11.992h4.638c0-4.923 4.882-8.731 10.064-6.855a6.95 6.95 0 014.147 4.148c1.889 5.177-1.924 10.055-6.84 10.064v-4.61H7.391v4.623h4.61V24c7.86 0 13.967-7.588 11.397-15.83-1.115-3.59-3.985-6.446-7.575-7.575A12.8 12.8 0 0012.039 0zM7.39 19.362H3.828v3.564H7.39zm-3.563 0v-2.978H.85v2.978z" },
    "namecheap": { name: "Namecheap", bg: "#D93522", ink: "#ffffff", kind: "", path: "M17.295 17.484c.227.403.57.728.985.931-.309.15-.647.229-.99.232h-3.068a2.26 2.26 0 0 1-1.957-1.143L6.705 6.511a2.27 2.27 0 0 0-.974-.922c.309-.153.652-.233.997-.232h3.05c.81.003 1.558.438 1.959 1.143l5.558 10.984zm-9.329-7.392L6.269 6.755c-.209-.392-.582-.657-.984-.829-.204.165-.391.35-.522.581-.184.349-4.391 8.648-4.569 8.987a2.245 2.245 0 0 0 4.016 1.999l3.756-7.401zm15.846-1.593a2.245 2.245 0 0 0-1.162-2.955v-.001a2.243 2.243 0 0 0-.892-.187l-.003-.011c-.816 0-1.569.443-1.965 1.157l-3.749 7.414 1.689 3.323c.213.399.59.664.998.839.252-.2.473-.444.605-.742l4.479-8.837z" },
    "porkbun": { name: "Porkbun", bg: "#EF7878", ink: "#111111", kind: "", path: "M12 0C5.3708 0 .0176 5.3532.0176 11.9824.0176 18.6117 5.3708 24 12 24s11.9824-5.3532 11.9824-11.9824C23.9824 5.3883 18.6292 0 12 0ZM5.832 5.8848c1.0635.2481 2.092.6384 3.0137 1.1347-1.099.5318-1.9866 1.3824-2.6602 2.375-.4254-.5672-.6738-1.2767-.6738-2.0566 0-.5318.1076-.9923.3203-1.4531zm12.336 0c.2127.4254.3203.9213.3203 1.453 0 .78-.2484 1.4895-.6738 2.0567-.6736-.9926-1.5967-1.8432-2.6602-2.375a9.9821 9.9821 0 0 1 3.0137-1.1347zm-6.0723.8105c3.5286.0471 6.3547 2.9198 6.3203 6.457v3.8282c0 .638-.5318 1.1699-1.17 1.1699-.638 0-1.1698-.5318-1.1698-1.17v-.957H7.8516v.957c0 .6382-.5319 1.17-1.17 1.17-.638 0-1.1699-.5318-1.1699-1.17v-3.6503c0-3.5096 2.7307-6.489 6.2403-6.6309.1152-.0044.2299-.0054.3437-.0039zm1.5 3.7988c-.4963 0-.9219.4256-.9219.922 0 .248.0711.4242.213.6015.1417.2127.3536.3546.5663.461-.1418.0708-.3188.1425-.496.1425-.2128 0-.3907.176-.3907.3887s.178.3906.3906.3906h.1778c.6026 0 1.1346-.3553 1.3828-.8516.39-.1418.7092-.3896.9219-.7441.0709-.1064.0337-.2484-.0372-.2129-.1063-.0355-.2123-.034-.2832.0723-.1063.1418-.2485.2826-.4257.3535v-.1426c0-.39-.1409-.7086-.3536-.9922-.1772-.2481-.425-.3887-.7441-.3887zm0 .5313c.2127 0 .3532.1408.3887.3535v.1777c0 .1773-.0346.3543-.1055.4961-.2481-.0709-.4617-.213-.6035-.4257-.0355-.071-.0703-.14-.0703-.211 0-.2392.2063-.3906.3906-.3906z" },
    "bitwarden": { name: "Bitwarden", bg: "#175DDC", ink: "#ffffff", kind: "", path: "M21.722.296A.964.964 0 0 0 21.018 0H2.982a.959.959 0 0 0-.703.296.96.96 0 0 0-.297.702v12c0 .895.174 1.783.523 2.665.349.88.783 1.66 1.3 2.345.517.68 1.132 1.346 1.848 1.993a21.807 21.807 0 0 0 1.98 1.609c.605.427 1.235.83 1.893 1.212.657.381 1.125.638 1.4.772.276.134.5.241.664.311a.916.916 0 0 0 .814 0c.168-.073.389-.177.667-.311.275-.134.743-.394 1.401-.772a25.305 25.305 0 0 0 1.894-1.212A21.891 21.891 0 0 0 18.348 20c.716-.647 1.33-1.31 1.847-1.993s.949-1.463 1.3-2.345c.35-.879.524-1.767.524-2.665V1.001a.95.95 0 0 0-.297-.705zm-2.325 12.815c0 4.344-7.397 8.087-7.397 8.087V2.57h7.397v10.54z" },
    "mullvad": { name: "Mullvad VPN", bg: "#294D73", ink: "#ffffff", kind: "", path: "M12 0C5.371 0 0 5.362 0 12c0 6.629 5.381 12 12 12s12-5.371 12-12S18.629 0 12 0zm1.651 3.363c1.908-.02 4.059 1.28 4.701 2.951.381 1 .267 2.086-.057 3.086-.266.819-1.238 2-.876 2.886-.143-.038-3.124-1.048-3.98-1.505-1.344-.838-2.544-1.867-3.448-2.657l-.03-.029-3.047-1.447a1.037 1.037 0 0 1-.104-.058c.419.029 2.085.23 2.828.058-.143-.39-.105-.896.095-1.372.286-.657.83-1.095 1.343-1.095.105 0 .2.019.296.057A3.411 3.411 0 0 1 12.39 3.6a3.49 3.49 0 0 1 1.26-.237zm-2.499.97c-.457 0-.962.42-1.228 1.02-.2.447-.229.933-.086 1.304a.813.813 0 0 0 .41.457.696.696 0 0 0 .285.058c.457 0 .962-.42 1.22-1.02.161-.362.209-.742.152-1.076a.91.91 0 0 0-.467-.676.6.6 0 0 0-.286-.067zm0 .286c.057 0 .115.01.172.038.152.067.266.238.304.467.048.276.01.6-.133.905-.21.485-.619.838-.962.838a.444.444 0 0 1-.162-.029c-.142-.057-.219-.19-.257-.295-.114-.286-.085-.705.076-1.086.21-.495.62-.838.962-.838zM3.01 6.362 2.943 7.79l.133.037.943-1.123-.648 1.104c1.01-.2 2.658-.247 4.42-.114l1.837.895c.915.8 2.124 1.839 3.486 2.686l3.553 1.4.438.638h-.372l.781.943-.714-.114c.01.066.714.876.714.876l-.562.076c.02.067.572.753.572.753l-.42-.03c.03.106.677 1.153.677 1.163 0 .01-.229-.057-.381-.105.543 1.21 1.324 1.448 1.362 1.943-2.667 3.419-9.667 3.952-12.771.124-.067-.314.619-.838 1.057-1.429.21-.286.4-.59.533-.905.19-.58-.21-.533-.476-1.028-.047-.086-.086-.2-.047-.305.057-.19.38-.324.438-.286 1.314.877 3.762.59 5.266-1.142 0 0 .458.114.696.18l-.686-.457-.048-.028c-.028.019-.067.038-.095.057-3.124 2.38-5.152 1.352-5.152 1.352a3.243 3.243 0 0 0-.438-.39c-2.124-1.495-3.639-3.505-4.324-4.81l-.257 1.381.057-1.838-.914 1.276.676-1.371c-.505-.067-.79-.572-.676-.981.094-.426.63-.738 1.096-.527z" },
    "github": { name: "GitHub", bg: "#181717", ink: "#ffffff", kind: "", path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" },
    "docker": { name: "Docker", bg: "#2496ED", ink: "#111111", kind: "", path: "M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" },
    "synology": { name: "Synology", bg: "#B5B5B6", ink: "#111111", kind: "", letters: "S" },
    "twitch": { name: "Twitch", bg: "#9146FF", ink: "#ffffff", kind: "", path: "M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" },
    "discord": { name: "Discord", bg: "#5865F2", ink: "#ffffff", kind: "", path: "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" },
    // More from simple-icons: streaming, software, travel, shops, and the services a household pays.
    "steam": { name: "Steam", bg: "#000000", ink: "#ffffff", kind: "", path: "M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" },
    "fandango": { name: "Fandango", bg: "#FF7300", ink: "#111111", kind: "", path: "M13.664 6.956L8.05 8.496 9.19 12.72l5.615-1.54L15.95 15.4l-5.615 1.49 1.093 4.224-5.615 1.49L4.42 17.54c.846-.995 1.194-2.386.846-3.728-.398-1.342-1.392-2.385-2.584-2.832L1.29 5.763 12.57 2.78zm7.106-.198L18.932.05 0 5.068l1.838 6.758c1.093.2 2.087 1.043 2.385 2.236.348 1.193-.1 2.385-.944 3.18l1.788 6.708L24 18.882l-1.79-6.708c-1.142-.2-2.086-1.043-2.434-2.236-.298-1.193.1-2.435.994-3.18z" },
    "notion": { name: "Notion", bg: "#000000", ink: "#ffffff", kind: "", path: "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" },
    "zoom": { name: "Zoom", bg: "#0B5CFF", ink: "#ffffff", kind: "", letters: "Z" },
    "grammarly": { name: "Grammarly", bg: "#027E6F", ink: "#ffffff", kind: "", path: "M12 24H.032V12c0-3.314 1.341-6.314 3.504-8.486C5.703 1.344 8.694 0 12 0c3.305 0 6.297 1.344 8.463 3.514 2.164 2.172 3.505 5.172 3.505 8.486s-1.338 6.314-3.505 8.486C18.297 22.656 15.305 24 12 24m2.889-13.137-1.271 2.205h4.418c-.505 2.882-3.018 5.078-6.036 5.078-3.38 0-6.132-2.757-6.132-6.146S8.618 5.854 12 5.854c1.821 0 3.458.801 4.584 2.069l1.143-1.988c-1.493-1.418-3.506-2.29-5.725-2.29-4.6 0-8.332 3.74-8.332 8.355s3.73 8.354 8.332 8.354c4.603 0 8.332-3.739 8.332-8.354 0-.387-.029-.765-.079-1.137z" },
    "spectrum": { name: "Spectrum", bg: "#7B16FF", ink: "#ffffff", kind: "", path: "M0 10.2A1.8 1.8 0 001.8 12h1.8a8.4 8.4 0 018.4 8.4v1.8a1.8 1.8 0 001.8 1.8h8.4a1.8 1.8 0 001.8-1.8v-1.8C24 9.133 14.867 0 3.6 0H1.8A1.8 1.8 0 000 1.8v8.4z" },
    "headspace": { name: "Headspace", bg: "#F47D31", ink: "#111111", kind: "", path: "M23.9711 11.8612c.279 3.8878-1.5272 6.0933-2.6155 7.6357-1.694 1.7856-3.8397 4.2203-9.291 4.3565-4.6237.1827-6.8957-1.8508-8.8034-3.617-2.487-2.7336-3.1366-4.3512-3.261-8.3752-.0118-2.467.9397-4.9292 2.6025-7.0954C4.934 1.4736 8.6408.3699 12.0646.1426c3.5923-.1392 6.4493 1.6723 8.3993 3.624 2.4963 2.632 3.2629 4.8923 3.5054 8.0946Z" },
    "hellofresh": { name: "HelloFresh", bg: "#99CC33", ink: "#111111", kind: "", path: "M9.7894 22.2329c-.9661-.0974-2.0001-.326-3.042-.7589-.5912-.2456-1.1673-.5843-1.2123-.6109-.362-.2057-.6568-.457-1.2135-.7269-.7048-.3416-1.3836-.5276-2.1106-.611-.9842-.0661-1.038.0124-1.319-.0745-.1676-.0545-.3188-.1205-.495-.2848-.0526-.049-.125-.1304-.1607-.1808-.125-.1763-.1744-.3314-.194-.3997-.0284-.0981-.0424-.1563-.0423-.3324 0-.1565.0152-.2397.035-.3116.0763-.2788.173-.3408.4299-.8472.3285-.6476.5238-1.285.6176-1.9564a5.7292 5.7292 0 0 0 .0554-1.017c-.015-.5062-.0383-.6133-.0392-1.0444-.0026-1.2549.2374-2.3546.5533-3.2859.2061-.6079.3889-1.007.6046-1.4333.5845-1.1551 1.5013-2.4784 2.9354-3.6924.7732-.6545 1.9737-1.5002 3.5538-2.1176 1.3446-.5253 2.5225-.7015 3.064-.7614.664-.087 1.8067-.1234 2.975.0535.9966.151 2.2445.4867 3.5131 1.2.4312.2424.6815.4377 1.014.6296.814.4697 1.6498.7054 2.4477.8015.424.051 1.0618.0047 1.302.0666.1477.0381.2551.0862.3896.1755.1135.0755.3629.2761.4912.6485.061.1772.1243.6076-.0987.9911-.0365.063-.1066.183-.1557.2669-.0491.0838-.1423.2622-.2072.3964-.6611 1.3677-.6465 2.5461-.6009 3.263.0534.84.05 2.2341-.5417 3.9644-.1037.3032-.3364.9313-.7023 1.6143-.8281 1.5455-1.876 2.6331-2.5374 3.2256-1.474 1.3204-2.9634 2.038-3.9265 2.4021-.8975.3393-1.5834.5095-2.3024.6327-.6934.1188-1.8193.2425-3.0802.1154z" },
    "instacart": { name: "Instacart", bg: "#43B02A", ink: "#111111", kind: "", path: "M15.629 9.619c1.421 1.429 2.58 3.766 1.917 5.152-1.778 3.715-15.04 10.226-16.169 9.1C.252 22.746 6.768 9.476 10.481 7.697c1.388-.66 3.724.51 5.152 1.92l-.005.014v-.012zm7.028-1.566c-.231-.855-.821-1.717-1.7-1.82-1.61-.186-4.151 2.663-3.971 3.339.181.69 3.766 1.875 5.1.915.691-.494.781-1.56.556-2.414l.015-.02zM17.666.158c1.198.324 2.407 1.148 2.551 2.382.261 2.259-3.732 5.819-4.68 5.564-.948-.251-2.618-5.284-1.269-7.162.695-.972 2.201-1.106 3.399-.788v.004h-.001z" },
    "brex": { name: "Brex", bg: "#212121", ink: "#ffffff", kind: "card", path: "M18.69 2.319a3.868 3.868 0 0 0-3.108 1.547l-.759 1.007a1.658 1.658 0 0 1-1.313.656H0V21.68h5.296a3.87 3.87 0 0 0 3.108-1.547l.759-1.006a1.656 1.656 0 0 1 1.313-.657H24V2.319h-5.31Zm1.108 11.949h-5.66a3.87 3.87 0 0 0-3.108 1.547l-.759 1.007a1.658 1.658 0 0 1-1.313.656H4.202V9.731h5.661a3.868 3.868 0 0 0 3.107-1.547l.759-1.006a1.658 1.658 0 0 1 1.313-.657h4.771l-.015 7.747Z" },
    "square": { name: "Square", bg: "#3E4348", ink: "#ffffff", kind: "", path: "M4.01 0A4.01 4.01 0 000 4.01v15.98c0 2.21 1.8 4 4.01 4.01h15.98C22.2 24 24 22.2 24 19.99V4A4.01 4.01 0 0019.99 0H4zm1.62 4.36h12.74c.7 0 1.26.57 1.26 1.27v12.74c0 .7-.56 1.27-1.26 1.27H5.63c-.7 0-1.26-.57-1.26-1.27V5.63a1.27 1.27 0 011.26-1.27zm3.83 4.35a.73.73 0 00-.73.73v5.09c0 .4.32.72.72.72h5.1a.73.73 0 00.73-.72V9.44a.73.73 0 00-.73-.73h-5.1Z" },
    "stripe": { name: "Stripe", bg: "#635BFF", ink: "#ffffff", kind: "", path: "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" },
    "afterpay": { name: "Afterpay", bg: "#B2FCE4", ink: "#111111", kind: "", path: "M12 0C5.373 0 0 5.373 0 12c0 6.628 5.373 12 12 12 6.628 0 12-5.372 12-12 0-6.627-5.372-12-12-12Zm1.236 4.924a2.21 2.21 0 0 1 1.15.299l4.457 2.557c1.495.857 1.495 3.013 0 3.87l-4.457 2.558c-1.488.854-3.342-.22-3.342-1.935v-.34a.441.441 0 0 0-.66-.383L6.287 13.9a.441.441 0 0 0 0 .765l4.096 2.35a.44.44 0 0 0 .661-.382v-.685c0-.333.36-.542.649-.376l1.041.597a.441.441 0 0 1 .222.383v.29c0 1.715-1.854 2.789-3.342 1.935L5.157 16.22c-1.495-.857-1.495-3.013 0-3.87l4.457-2.558c1.488-.854 3.342.22 3.342 1.935v.34c0 .34.366.551.66.383l4.097-2.35a.441.441 0 0 0 0-.765l-4.096-2.351a.441.441 0 0 0-.661.382v.685c0 .333-.36.541-.649.375l-1.041-.597a.442.442 0 0 1-.222-.383v-.29c0-1.285 1.043-2.21 2.192-2.233z" },
    "applepay": { name: "Apple Pay", bg: "#000000", ink: "#ffffff", kind: "", letters: "AP" },
    "googlepay": { name: "Google Pay", bg: "#4285F4", ink: "#111111", kind: "", letters: "GP" },
    "zelle": { name: "Zelle", bg: "#6D1ED4", ink: "#ffffff", kind: "", path: "M13.559 24h-2.841a.483.483 0 0 1-.483-.483v-2.765H5.638a.667.667 0 0 1-.666-.666v-2.234a.67.67 0 0 1 .142-.412l8.139-10.382h-7.25a.667.667 0 0 1-.667-.667V3.914c0-.367.299-.666.666-.666h4.23V.483c0-.266.217-.483.483-.483h2.841c.266 0 .483.217.483.483v2.765h4.323c.367 0 .666.299.666.666v2.137a.67.67 0 0 1-.141.41l-8.19 10.481h7.665c.367 0 .666.299.666.666v2.477a.667.667 0 0 1-.666.667h-4.32v2.765a.483.483 0 0 1-.483.483Z" },
    "americanairlines": { name: "American Airlines", bg: "#0078D2", ink: "#ffffff", kind: "", path: "M0 .244h3.264c1.377 0 1.942.563 2.499 1.116.637.58 2.57 3.196 6.657 8.303H7.997c-1.809 0-2.38-.308-3.08-1.375zm10.424 17.072l-2.427-4.013c-.292-.455-.372-.854-.372-1.318 0-.51.217-.79 1.053-1.233.973-.466 2.933-.67 4.954-.67 3.283 0 4.07 1.055 4.405 2.192 0 0-.464-.185-1.554-.185-3.459 0-6.223 1.68-6.223 4.221 0 .534.164 1.006.164 1.006zm4.936-3.417c-2.547.089-5.032 1.869-4.936 3.416l2.7 4.486c.836 1.344 2.215 1.955 3.932 1.955H24l-8.13-9.852a5.55 5.55 0 0 0-.51-.005Z" },
    "delta": { name: "Delta", bg: "#003366", ink: "#ffffff", kind: "", letters: "D" },
    "unitedairlines": { name: "United Airlines", bg: "#002244", ink: "#ffffff", kind: "", path: "M5.327 3.067c8.654 0 15.695 7.068 15.695 15.754 0 1.762-.298 3.515-.875 5.179H24V0H0v4.003l.019-.007a15.569 15.569 0 0 1 5.308-.929M0 10.534c.975-1.389 1.116-2.983.26-3.761a1.56 1.56 0 0 0-.26-.19zm5.027-5.057c-.863-.99-2.3-1.33-3.969-1.092l-.135.02a7.873 7.873 0 0 0-.386.077C.28 4.542.104 4.6 0 4.64v.5a8.47 8.47 0 0 1 .505-.37c.333-.07.656-.116.968-.136C.99 4.91.434 5.283 0 5.627v.385l.015.009s1.224-.969 2.196-1.386c.234.017.458.05.672.099A14.624 14.624 0 0 0 .284 6.168c.15.088.285.199.303.213.019-.012 1.427-.892 2.977-1.42.21.096.413.216.589.351-1.688.474-3.31 1.321-3.31 1.321.092.106.172.221.242.344l.029-.011c1.727-.74 3.562-1.118 3.562-1.118.143.196.262.416.352.658 0 0-1.647.188-3.765.868.093.292.119.512.119.515 0 0 1.997-.447 3.839-.497.026.296.016.628-.026.969-1.09-.058-3.69.08-3.791.089 0 0-.01.374-.107.726 0 0 1.899.061 3.626.383a8.406 8.406 0 0 1-.507 1.22c-1.15-.346-2.897-.766-3.357-.871a5.64 5.64 0 0 1-.453.88s2.134.93 2.953 1.386h.002v.001c-.356.532-1.06 1.277-1.06 1.277a73.343 73.343 0 0 0-.58-.43L.005 11.685 0 11.68v1.765l1.107 1.292c-.364.294-.736.562-1.107.802v1.053l.041-.026a15.948 15.948 0 0 0 1.492-1.151c3.819-3.323 5.383-7.773 3.495-9.94m4.701.184C7.917 3.221 5.08 3.57 4.234 3.688c-.929.13-1.631.334-1.631.334.207.019.49.056.694.097.15-.036 1.454-.333 2.402-.209h.003c-.697.076-1.647.363-1.746.394h-.002a3.154 3.154 0 0 1 .663.3c.102-.026 1.392-.369 2.623-.393 0 0 .455.202.893.503-1.59-.006-2.907.3-2.942.308.186.165.371.364.537.603 1.744-.262 3.248-.148 3.248-.148s.204.25.296.383a5 5 0 0 1 .327.563c-1.779-.208-3.48-.059-3.482-.059.118.303.197.627.24.968.197-.002 1.704.001 3.623.346.062.44.068.912.02 1.41a25.761 25.761 0 0 0-3.622-.65c-.035.43-.116.877-.242 1.336.192.045 2.317.552 3.506 1.034a12.226 12.226 0 0 1-.707 1.76c-.958-.472-3.307-1.39-3.307-1.39a12.625 12.625 0 0 1-.858 1.588s2.014 1.15 2.984 1.786a18.19 18.19 0 0 1-1.511 1.875c-.704-.63-2.464-1.994-2.597-2.097a25.338 25.338 0 0 1-1.496 1.596l2.112 2.422-.06.053c-.458.38-.95.736-1.366 1.022-.361.245-.66.435-.762.501a302.864 302.864 0 0 1-1.615-2.596c-.152.113-.305.22-.458.326v4.539c.248-.12.497-.244.745-.376a18.882 18.882 0 0 0 3.422-2.19 21.666 21.666 0 0 0 2.125-1.93 18.942 18.942 0 0 0 2.2-2.704c2.329-3.438 2.952-7.023 1.236-9.333m3.701.829a3.523 3.523 0 0 0-.4-.468 4.523 4.523 0 0 0-.4-.344c-1.502-1.133-4.268-1.7-4.268-1.7.264.141.484.285.485.286.013.004 1.128.283 2.117.767 0 0-.9-.204-1.476-.284.238.21.465.45.664.703 0 0 1.835.335 2.64.776 0 0 .386.397.701 1.093-1.257-.51-2.682-.777-2.682-.777.19.424.325.878.408 1.35 0 0 1.566.383 2.742.948.102.559.14 1.136.118 1.72a21.613 21.613 0 0 0-2.77-1.134 9.298 9.298 0 0 1-.287 1.865s1.898.847 2.75 1.362a13.329 13.329 0 0 1-.77 2.201c-1.299-.844-2.673-1.594-2.673-1.594-.346.83-1.195 2.187-1.195 2.187.022.015 1.436.986 2.52 1.847a20.88 20.88 0 0 1-1.807 2.346 304.27 304.27 0 0 0-2.312-2.068 22.358 22.358 0 0 1-2.095 2.12l2.008 2.273c-1.302 1.074-2.601 1.887-2.601 1.887L3.17 21.47s-1.18.897-3.17 1.84V24h6.537c7.297-5.52 9.886-13.415 6.892-17.511M12.967 24c1.704-1.905 3.155-4.147 4.027-6.547.757-2.082 1.169-4.625.5-6.887a6.312 6.312 0 0 0-.155-.45 5.429 5.429 0 0 0-.794-1.415 15.18 15.18 0 0 0-2.749-2.413c.15.191.285.389.402.589 0 0 1.231.913 1.946 1.84-.917-.652-1.436-.917-1.503-.95l-.008-.004c.348.859.453 1.57.453 1.57s1.088.568 2.067 1.416c.136.627.192 1.27.183 1.913-.987-.869-2.13-1.547-2.13-1.547a11.7 11.7 0 0 1-.284 2.204s1.079.683 2.13 1.64c0 0-.302 1.358-.789 2.424a26.291 26.291 0 0 0-2.069-1.726s-.5 1.305-1.312 2.616a61.394 61.394 0 0 1 1.959 1.789 21.41 21.41 0 0 1-1.943 2.57v.001l-1.807-1.798a23.958 23.958 0 0 1-2.392 2.55c.04.046.404.45.553.615zm3.213 0h.902c2.567-3.792 2.696-7.153 2.696-7.797 0-1.216-.204-2.334-.546-3.219 0 0-.532-1.375-1.362-2.6a11.694 11.694 0 0 1 .377 1.413c.163.273.9 1.572.999 3.001v.004s-.52-.729-.907-1.19a12.068 12.068 0 0 1-.28 2.33s.772.894 1.117 1.47c0 0-.235 1.258-.738 2.462-.512-.745-1.166-1.468-1.166-1.468a19.217 19.217 0 0 1-1.406 2.778s.978 1.144 1.192 1.47c-.287.484-.567.905-.878 1.346m3.27 0c.194-.525.369-1.085.512-1.654a15.228 15.228 0 0 0 .28-5.658c-.069.998-.243 1.873-.243 1.873.041.132.114.349.147.482v.001a17.79 17.79 0 0 1-.575 2.995c-.131-.484-.307-.95-.318-.98h-.001c-.353.94-.881 2.05-1.361 2.941Z" },
    "southwestairlines": { name: "Southwest Airlines", bg: "#304CB2", ink: "#ffffff", kind: "", path: "M22.163 2.419C21.038 1.219 19.35.58 17.437.58c-2.062 0-3.637.675-4.725 1.275 2.063 1.163 6.526 3.75 11.175 7.163.075-.45.113-.938.113-1.388-.038-2.175-.675-4.012-1.837-5.212zm1.35 8.212C18.186 6.244 15 4.031 11.55 1.97 10.612 1.406 8.775.58 6.675.58 4.688.581 3 1.22 1.837 2.42 1.087 3.206.563 4.18.262 5.38 3 7.294 10.462 12.656 18 18.581c2.512-2.362 4.613-5.1 5.512-7.95zM0 7.781c0 6.15 6.487 11.85 12 15.638 1.575-1.088 3.225-2.325 4.8-3.713A736.871 736.871 0 0 0 .15 6.131C.038 6.62 0 7.181 0 7.781Z" },
    "marriott": { name: "Marriott", bg: "#A70023", ink: "#ffffff", kind: "", path: "M8.802 11.083l-1.178 2.41c-.8 1.425-1.931 3.167-3.646 3.603-.668.232-1.255.023-1.9-.023L0 20.476a1.626 1.626 0 0 0 .59.386c3.647 1.39 5.122-.1 8.722-8.238l3.403 7.249h4.53l-2.14-4.893 1.213-2.53 3.345 7.311 4.337.027-7.59-16.677-3.475 1.738 2.738 6.222-1.201 2.445L9.45 2.678l-3.7 1.877Z" },
    "hilton": { name: "Hilton", bg: "#231F20", ink: "#ffffff", kind: "", letters: "H" },
    "airbnb": { name: "Airbnb", bg: "#FF5A5F", ink: "#111111", kind: "", path: "M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.263-1.027-.16-1.848.291-2.465.477-.71 1.188-1.056 2.121-1.056s1.643.345 2.12 1.063c.446.61.558 1.432.286 2.465-.291 1.298-1.085 2.785-2.412 4.458zm9.601 1.14c-.185 1.246-1.034 2.28-2.2 2.783-2.253.98-4.483-.583-6.392-2.704 3.157-3.951 3.74-7.028 2.385-9.018-.795-1.14-1.933-1.695-3.394-1.695-2.944 0-4.563 2.49-3.927 5.382.37 1.565 1.352 3.343 2.917 5.332-.98 1.085-1.91 1.856-2.732 2.333-.636.344-1.245.558-1.828.609-2.679.399-4.778-2.2-3.825-4.88.132-.345.395-.98.845-1.961l.025-.053c1.464-3.178 3.242-6.79 5.285-10.795l.053-.132.58-1.116c.45-.822.635-1.19 1.351-1.643.346-.21.77-.315 1.246-.315.954 0 1.698.558 2.016 1.007.158.239.345.557.582.953l.558 1.089.08.159c2.041 4.004 3.821 7.608 5.279 10.794l.026.025.533 1.22.318.764c.243.613.294 1.222.213 1.858zm1.22-2.39c-.186-.583-.505-1.271-.9-2.094v-.03c-1.889-4.006-3.642-7.608-5.307-10.844l-.111-.163C15.317 1.461 14.468 0 12.001 0c-2.44 0-3.476 1.695-4.535 3.898l-.081.16c-1.669 3.236-3.421 6.843-5.303 10.847v.053l-.559 1.22c-.21.504-.317.768-.345.847C-.172 20.74 2.611 24 5.98 24c.027 0 .132 0 .265-.027h.372c1.75-.213 3.554-1.325 5.384-3.317 1.829 1.989 3.635 3.104 5.382 3.317h.372c.133.027.239.027.265.027 3.37.003 6.152-3.261 4.802-6.975z" },
    "etsy": { name: "Etsy", bg: "#F16521", ink: "#111111", kind: "", path: "M8.559 2.445c0-.325.033-.52.59-.52h7.465c1.3 0 2.02 1.11 2.54 3.193l.42 1.666h1.27c.23-4.728.43-6.784.43-6.784s-3.196.36-5.09.36H6.635L1.521.196v1.37l1.725.326c1.21.24 1.5.496 1.6 1.606 0 0 .11 3.27.11 8.64 0 5.385-.09 8.61-.09 8.61 0 .973-.39 1.333-1.59 1.573l-1.722.33V24l5.13-.165h8.55c1.935 0 6.39.165 6.39.165.105-1.17.75-6.48.855-7.064h-1.2l-1.284 2.91c-1.005 2.28-2.476 2.445-4.11 2.445h-4.906c-1.63 0-2.415-.64-2.415-2.05V12.8s3.62 0 4.79.096c.912.064 1.463.325 1.76 1.598l.39 1.695h1.41l-.09-4.278.192-4.305h-1.391l-.45 1.89c-.283 1.244-.48 1.47-1.754 1.6-1.666.17-4.815.14-4.815.14V2.45h-.05z" },
    "ebay": { name: "eBay", bg: "#E03136", ink: "#ffffff", kind: "", letters: "E" },
    "starbucks": { name: "Starbucks", bg: "#006241", ink: "#ffffff", kind: "", path: "M13.2072 5.2801c-.1052-.0188-.6126-.104-1.2072-.104s-1.102.0848-1.2072.104c-.0605.0108-.0837-.0484-.0377-.0828.0417-.0308 1.2445-.9463 1.2445-.9463l1.244.9463c.0469.0344.024.0936-.0364.0828zm-2.0783 5.9446s-.0636.0228-.0804.0788c.252.1937.4257.6343.9515.6343s.6995-.4406.9511-.6343c-.0164-.0564-.08-.0788-.08-.0788s-.3293.0776-.8711.0776c-.5418 0-.8711-.0776-.8711-.0776zM12 10.4832c-.146 0-.178-.0552-.2777-.0548-.0948.0004-.2789.076-.319.1453a.1542.1542 0 00.0413.0948c.2129.032.309.1505.5558.1505.2469 0 .3425-.1185.5558-.1505a.1579.1579 0 00.0412-.0948c-.0396-.0692-.224-.1445-.3193-.1453-.1-.0008-.1324.0548-.2781.0548zm11.9868 2.27a11.964 11.964 0 01-.076.8528c-1.359.2249-1.8447-.986-3.2368-.9252.0832.2954.1508.5963.2029.9036 1.148-.0008 1.6105 1.0724 2.8878.9143-.0672.3281-.148.6519-.2413.9708-1.01.0992-1.3657-.9044-2.5345-.8767.0096.1664.0148.3345.0148.5041l-.0048.2805 2.2696.866a12.04 12.04 0 01-.3965.9479c-.6823-.0376-.9175-.9127-1.9555-.8431a9.0882 9.0882 0 01-.118.665c.9015-.0632 1.0955.7667 1.7414.834a12.2317 12.2317 0 01-.5302.8767c-.3826-.205-.7143-.8231-1.4398-.8612a8.6035 8.6035 0 00.195-.6994c-.6435 0-1.3794-.2509-1.9964-.8127.2-1.1388-1.5674-2.2984-1.5674-3.1324 0-.9059.4582-1.4073.4582-2.6285 0-.9063-.4402-1.8895-1.104-2.5614a2.2175 2.2175 0 00-.4114-.3309c.6098.7547 1.078 1.6494 1.078 2.6858 0 1.15-.535 1.757-.535 2.8186 0 1.0612 1.5526 1.9796 1.5526 3.074 0 .4305-.1377.851-.5914 1.677.697.6962 1.605 1.076 2.1908 1.076.19 0 .292-.058.3601-.2073a9.0925 9.0925 0 00.1665-.391c.631.0245.9199.5979 1.2692.8268-.1916.2573-.393.5057-.6038.7462-.234-.2593-.5486-.6954-1.0092-.8167a9.2087 9.2087 0 01-.2613.473c.3966.108.6679.5082.878.7715a12.1305 12.1305 0 01-.7075.6754c-.1532-.2384-.3917-.541-.659-.7042a8.3639 8.3639 0 01-.3077.391c.2272.154.4277.4313.5586.6574-.2833.2272-.5763.443-.8796.6446-.1496-1.2192-1.8138-2.0548-1.3653-3.4693-.1472.2493-.3229.561-.3229.9364 0 1.024 1.0908 1.8366 1.1776 2.8542-.226.1353-.4573.2625-.693.383-.0392-1.1185-1.194-2.3425-1.194-3.2604 0-1.0248 1.342-2.054 1.342-3.2636 0-1.2105-1.5485-2.0484-1.5485-3.1112 0-1.062.6586-1.673.6586-3.0343 0-.9972-.4738-2.0063-1.2056-2.651-.1297-.1144-.2573-.2052-.4106-.2849.6903.828 1.0904 1.579 1.0904 2.7186 0 1.2801-.7546 1.9908-.7546 3.244 0 1.2537 1.5197 1.9507 1.5197 3.1192 0 1.1684-1.4145 2.1532-1.4145 3.3536 0 1.092 1.2468 2.182 1.2653 3.4777a11.7704 11.7704 0 01-.8327.3257c.1584-1.3089-1.245-2.659-1.245-3.727 0-1.1676 1.4674-2.1712 1.4674-3.43 0-1.2597-1.4917-1.8451-1.4917-3.138 0-1.292.9151-2.0075.9151-3.4352 0-1.1129-.5494-2.1136-1.352-2.7338l-.0509-.0385c-.0756-.056-.138.0116-.0844.078.5682.7095.8719 1.427.8719 2.4894 0 1.306-1.0512 2.3673-1.0512 3.6325 0 1.4934 1.4117 1.9203 1.4117 3.1456 0 1.2248-1.5137 2.2048-1.5137 3.5053 0 1.206 1.4325 2.5445 1.1868 3.9366a11.6645 11.6645 0 01-.8743.192c.2689-1.7334-1.1364-2.9782-1.1364-4.1122 0-1.2277 1.5677-2.322 1.5677-3.5217 0-1.1316-1.1252-1.5014-1.2732-2.659-.0204-.158-.1473-.2753-.3221-.2461-.2285.0416-.5214.192-.9816.192-.4602 0-.753-.1508-.982-.192-.1744-.0288-.3013.0884-.3217.246-.1476 1.1577-1.2736 1.527-1.2736 2.659 0 1.1997 1.5681 2.2937 1.5681 3.5218 0 1.134-1.4053 2.3788-1.1368 4.1123a12.1233 12.1233 0 01-.8743-.1921c-.2457-1.3921 1.1872-2.7306 1.1872-3.9366 0-1.3005-1.5141-2.2805-1.5141-3.5053 0-1.2253 1.412-1.6522 1.412-3.1456 0-1.2652-1.0515-2.326-1.0515-3.6325 0-1.062.3037-1.7795.8723-2.4893.0532-.0665-.0088-.134-.0848-.078l-.0504.0384c-.802.6186-1.351 1.6193-1.351 2.7322 0 1.4277.9152 2.1431.9152 3.4352 0 1.2925-1.4917 1.878-1.4917 3.138 0 1.2588 1.4673 2.2624 1.4673 3.43 0 1.0684-1.4033 2.4181-1.2445 3.727a11.8995 11.8995 0 01-.833-.3257c.0188-1.2957 1.2648-2.3861 1.2648-3.4777 0-1.2004-1.4137-2.1852-1.4137-3.3536 0-1.1685 1.519-1.8655 1.519-3.1192 0-1.2532-.7543-1.9639-.7543-3.244 0-1.1396.3997-1.8907 1.09-2.7186-.1537.0797-.281.1705-.4102.285-.7318.6446-1.2052 1.6537-1.2052 2.651 0 1.3612.6586 1.9722.6586 3.0342 0 1.0628-1.5485 1.9007-1.5485 3.1112 0 1.2096 1.342 2.2392 1.342 3.2636 0 .9183-1.1556 2.1423-1.1944 3.2604a11.8754 11.8754 0 01-.693-.383c.0872-1.0176 1.1776-1.8303 1.1776-2.8542 0-.3754-.1753-.687-.323-.9364.4486 1.4145-1.2156 2.25-1.3652 3.4693a12.1204 12.1204 0 01-.8796-.6446c.1305-.2257.331-.5034.5586-.6575a7.9134 7.9134 0 01-.3077-.391c-.2677.1633-.5066.4659-.6594.7043a12.2459 12.2459 0 01-.707-.6754c.21-.2633.4813-.6635.8779-.7715a9.0433 9.0433 0 01-.2613-.473c-.4606.1213-.7755.5574-1.0092.8167a12.141 12.141 0 01-.6038-.7462c.3493-.229.6382-.8027 1.2688-.8267.0529.1312.1085.2617.1669.3909.068.1493.1705.2073.3601.2073.5858 0 1.4934-.3798 2.1908-1.076-.4537-.826-.5914-1.2465-.5914-1.677 0-1.094 1.5526-2.0124 1.5526-3.074 0-1.0615-.535-1.6686-.535-2.8186 0-1.0364.4682-1.9311 1.078-2.6858a2.2175 2.2175 0 00-.4114.331c-.6638.6722-1.104 1.655-1.104 2.5613 0 1.2212.4586 1.7226.4586 2.6285 0 .834-1.7679 1.9936-1.5678 3.1324-.617.5618-1.3529.8127-1.9967.8127a9.305 9.305 0 00.1949.6994c-.7251.0385-1.0568.6567-1.4398.8612a12.0872 12.0872 0 01-.5302-.8768c.6455-.0672.84-.897 1.7419-.8339a9.1275 9.1275 0 01-.1185-.665c-1.038-.0696-1.2732.8059-1.9555.8431a12.04 12.04 0 01-.3965-.948l2.27-.8659-.0048-.2805c0-.1696.0052-.3377.0144-.5041-1.1688-.0273-1.5246.976-2.5345.8767a12.106 12.106 0 01-.241-.9708c1.2766.158 1.7395-.9151 2.888-.9143a8.7482 8.7482 0 01.2024-.9036c-1.392-.0604-1.8779 1.1505-3.2364.9252a11.7352 11.7352 0 01-.076-.8527c1.5794.1764 2.1716-1.122 3.6097-.9632a8.4303 8.4303 0 01.471-.9963c-1.803-.317-2.4153 1.1908-4.0935.9591C.1813 5.2805 5.4844.0898 12 .0898S23.8187 5.2805 24 11.753c-1.6786.2317-2.2908-1.2757-4.0935-.9591.1773.32.335.6526.471.9963 1.4373-.1592 2.0295 1.1396 3.6093.9632zm-17.147-5.035c-.884-.3613-1.954-.278-2.868.309-.1416-.8504-.603-1.6058-1.26-2.0616-.0908-.0628-.1853-.0032-.1769.102.1389 1.7967-.9115 3.3569-2.2032 4.7282 1.3313.4001 2.4645-1.3141 4.1912-.7159a9.0364 9.0364 0 012.3168-2.3617zM12 6.6314c-1.1144 0-2.048.6303-2.2924 1.4446-.0188.0624.0068.1028.0788.0704.2005-.09.4285-.1333.6762-.1333.4546 0 .8551.1669 1.092.4574.1049.3457.1137.8463-.0048 1.132-.1872-.042-.2545-.1868-.4373-.1868-.1829 0-.3245.1284-.6347.1284-.3097 0-.346-.1465-.5498-.1465-.2396 0-.2837.247-.2837.5254 0 1.2417 1.1413 2.9503 2.3553 2.9503 1.2136 0 2.3549-1.7086 2.3549-2.9503 0-.2785-.0573-.517-.3077-.5494-.1249.09-.2397.1705-.5254.1705-.3102 0-.3958-.1284-.5783-.1284-.2204 0-.1984.465-.4601.491-.1745-.4194-.1829-.9572-.038-1.4362.2373-.2905.6374-.4574 1.092-.4574.2477 0 .4773.0437.6758.1333.0724.0324.0976-.0084.0788-.0704-.244-.8143-1.1772-1.4446-2.2916-1.4446zm1.7743 1.7815c-.2673 0-.5807.082-.7775.3013-.0204.0596-.0204.1484.0084.2077.4845-.166.9119-.1725 1.1184.0584.11-.1.1452-.19.1452-.2945 0-.1613-.164-.273-.4945-.273zm-3.8979.5674c.2337-.234.7263-.224 1.238-.0352.0225-.2545-.4333-.5326-.8887-.5326-.3309 0-.4945.1116-.4945.2733 0 .1044.0352.1949.1452.2945zm7.6804-4.2031c-.8799.0628-1.6442.3649-2.2624.8683.2625-.7443.5958-1.3953 1.0184-2.0264-1.1204.1189-2.0572.5286-2.7406 1.2289l-.535-1.4025 1.1876-1.0488-1.5902-.1125L12 .8053l-.635 1.479-1.5902.1124 1.1876 1.0488-.5346 1.4025c-.6838-.7003-1.6206-1.11-2.7402-1.2289.4218.6315.7551 1.2825 1.0176 2.0264-.6178-.5038-1.3821-.806-2.262-.8683.5278.6786.9955 1.402 1.342 2.18.0393.0876.1233.1164.2141.0712 1.2053-.599 2.5634-.936 4.0003-.936 1.437 0 2.7946.3374 4.0007.936.0908.0452.1748.0164.2136-.0712.347-.778.8147-1.5014 1.343-2.18zm1.9211 5.3035c1.7259-.5982 2.8595 1.1156 4.1908.7159-1.2917-1.3713-2.3417-2.9315-2.2028-4.7282.0084-.1052-.0865-.1652-.1769-.102-.6574.4558-1.1188 1.2112-1.26 2.0615-.9144-.587-1.984-.6706-2.868-.3089a9.0431 9.0431 0 012.317 2.3617z" },
    "mcdonalds": { name: "McDonald's", bg: "#FBC817", ink: "#111111", kind: "", path: "M17.243 3.006c2.066 0 3.742 8.714 3.742 19.478H24c0-11.588-3.042-20.968-6.766-20.968-2.127 0-4.007 2.81-5.248 7.227-1.241-4.416-3.121-7.227-5.231-7.227C3.031 1.516 0 10.888 0 22.476h3.014c0-10.763 1.658-19.47 3.724-19.47 2.066 0 3.741 8.05 3.741 17.98h2.997c0-9.93 1.684-17.98 3.75-17.98Z" },
    "shell": { name: "Shell", bg: "#FFD500", ink: "#111111", kind: "", path: "M12 .863C5.34.863 0 6.251 0 12.98c0 .996.038 1.374.246 2.33l3.662 2.71.57 4.515h6.102l.326.227c.377.262.705.375 1.082.375.352 0 .732-.101 1.024-.313l.39-.289h6.094l.563-4.515 3.695-2.71c.208-.956.246-1.334.246-2.33C24 6.252 18.661.863 12 .863zm.996 2.258c.9 0 1.778.224 2.512.649l-2.465 12.548 3.42-12.062c1.059.36 1.863.941 2.508 1.814l.025.034-4.902 10.615 5.572-9.713.033.03c.758.708 1.247 1.567 1.492 2.648l-6.195 7.666 6.436-6.5.01.021c.253.563.417 1.36.417 1.996 0 .509-.024.712-.164 1.25l-3.554 2.602-.467 3.71h-4.475l-.517.395c-.199.158-.482.266-.682.266-.199 0-.483-.108-.682-.266l-.517-.394H6.322l-.445-3.61-3.627-2.666c-.11-.436-.16-.83-.16-1.261 0-.72.159-1.49.426-2.053l.013-.024 6.45 6.551L2.75 9.621c.25-1.063.874-2.09 1.64-2.713l5.542 9.776L4.979 6.1c.555-.814 1.45-1.455 2.546-1.827l3.424 12.069L8.355 3.816l.055-.03c.814-.45 1.598-.657 2.457-.657.195 0 .286.004.528.03l.587 13.05.46-13.059c.224-.025.309-.029.554-.029z" },
    "epicgames": { name: "Epic Games", bg: "#313131", ink: "#ffffff", kind: "", letters: "E" },
    "ea": { name: "EA", bg: "#000000", ink: "#ffffff", kind: "", path: "M16.635 6.162l-5.928 9.377H4.24l1.508-2.3h4.024l1.474-2.335H2.264L.79 13.239h2.156L0 17.84h12.072l4.563-7.259 1.652 2.66h-1.401l-1.473 2.299h4.347l1.473 2.3H24zm-11.461.107L3.7 8.604l9.52-.035 1.474-2.3z" },
    "ubisoft": { name: "Ubisoft", bg: "#000000", ink: "#ffffff", kind: "", path: "M23.561 11.988C23.301-.304 6.954-4.89.656 6.634c.282.206.661.477.943.672a11.747 11.747 0 00-.976 3.067 11.885 11.885 0 00-.184 2.071C.439 18.818 5.621 24 12.005 24c6.385 0 11.556-5.17 11.556-11.556v-.455zm-20.27 2.06c-.152 1.246-.054 1.636-.054 1.788l-.282.098c-.108-.206-.37-.932-.488-1.908C2.163 10.308 4.7 6.96 8.57 6.33c3.544-.52 6.937 1.68 7.728 4.758l-.282.098c-.087-.087-.228-.336-.77-.878-4.281-4.281-11.002-2.32-11.956 3.74zm11.002 2.081a3.145 3.145 0 01-2.59 1.355 3.15 3.15 0 01-3.155-3.155 3.159 3.159 0 012.927-3.144c1.018-.043 1.972.51 2.416 1.398a2.58 2.58 0 01-.455 2.95c.293.205.575.4.856.595zm6.58.12c-1.669 3.782-5.106 5.766-8.77 5.712-7.034-.347-9.083-8.466-4.38-11.393l.207.206c-.076.108-.358.325-.791 1.182-.51 1.041-.672 2.081-.607 2.732.369 5.67 8.314 6.83 11.045 1.214C21.057 8.217 11.822.401 3.626 6.374l-.184-.184C5.599 2.808 9.816 1.3 13.837 2.309c6.147 1.55 9.453 7.956 7.035 13.94z" },
    "roblox": { name: "Roblox", bg: "#000000", ink: "#ffffff", kind: "", path: "M18.926 23.998 0 18.892 5.075.002 24 5.108ZM15.348 10.09l-5.282-1.453-1.414 5.273 5.282 1.453z" },
    "hbo": { name: "HBO", bg: "#000000", ink: "#ffffff", kind: "", path: "M7.042 16.896H4.414v-3.754H2.708v3.754H.01L0 7.22h2.708v3.6h1.706v-3.6h2.628zm12.043.046C21.795 16.94 24 14.689 24 11.978a4.89 4.89 0 0 0-4.915-4.92c-2.707-.002-4.09 1.991-4.432 2.795.003-1.207-1.187-2.632-2.58-2.634H7.59v9.674l4.181.001c1.686 0 2.886-1.46 2.888-2.713.385.788 1.72 2.762 4.427 2.76zm-7.665-3.936c.387 0 .692.382.692.817 0 .435-.305.817-.692.817h-1.33v-1.634zm.005-3.633c.387 0 .692.382.692.817 0 .436-.305.818-.692.818h-1.33V9.373zm1.77 2.607c.305-.039.813-.387.992-.61-.063.276-.068 1.074.006 1.35-.204-.314-.688-.701-.998-.74zm3.43 0a2.462 2.462 0 1 1 4.924 0 2.462 2.462 0 0 1-4.925 0zm2.462 1.936a1.936 1.936 0 1 0 0-3.872 1.936 1.936 0 0 0 0 3.872Z" },
    "showtime": { name: "Showtime", bg: "#B10000", ink: "#ffffff", kind: "", path: "M16.99 12.167c0-4.808 1.779-7.84 3.903-8.16C18.769 1.397 15.221 0 11.999 0 8.451 0 5.265 1.54 3.07 3.985c2.094.416 2.806 2.174 2.806 4.892H3.314c0-1.605-.334-2.436-1.284-2.436-.427 0-.758.217-.954.587-.027.06-.057.122-.084.184a2.115 2.115 0 0 0-.114.71c0 3.324 5.46 3.159 5.46 8.27 0 1.995-1.53 3.855-3.252 3.855C5.35 22.52 8.441 24 12 24c3.46 0 6.577-1.464 8.766-3.808-2.018-.509-3.776-3.413-3.776-8.025zm-1.142 7.921h-2.746V13.26h-2.967v6.83H7.384V4.327h2.746v6.348h2.972V4.327h2.746v15.761zM2.372 17.58c-1.32 0-2.399-2.32-2.372-5.8 1.905 1.72 3.681 2.11 3.681 4.145 0 .981-.543 1.655-1.309 1.655zM24 12.002c0 2.844-.896 5.409-2.1 5.409-1.445 0-2.181-2.703-2.181-5.498 0-2.654.771-5.308 2.181-5.308 1.676 0 2.1 4.102 2.1 5.397z" },
    "starz": { name: "STARZ", bg: "#082125", ink: "#ffffff", kind: "", letters: "S" },
    "tubi": { name: "Tubi", bg: "#7408FF", ink: "#ffffff", kind: "", letters: "T" },
    "medium": { name: "Medium", bg: "#000000", ink: "#ffffff", kind: "", path: "M4.21 0A4.201 4.201 0 0 0 0 4.21v15.58A4.201 4.201 0 0 0 4.21 24h15.58A4.201 4.201 0 0 0 24 19.79v-1.093c-.137.013-.278.02-.422.02-2.577 0-4.027-2.146-4.09-4.832a7.592 7.592 0 0 1 .022-.708c.093-1.186.475-2.241 1.105-3.022a3.885 3.885 0 0 1 1.395-1.1c.468-.237 1.127-.367 1.664-.367h.023c.101 0 .202.004.303.01V4.211A4.201 4.201 0 0 0 19.79 0Zm.198 5.583h4.165l3.588 8.435 3.59-8.435h3.864v.146l-.019.004c-.705.16-1.063.397-1.063 1.254h-.003l.003 10.274c.06.676.424.885 1.063 1.03l.02.004v.145h-4.923v-.145l.019-.005c.639-.144.994-.353 1.054-1.03V7.267l-4.745 11.15h-.261L6.15 7.569v9.445c0 .857.358 1.094 1.063 1.253l.02.004v.147H4.405v-.147l.019-.004c.705-.16 1.065-.397 1.065-1.253V6.987c0-.857-.358-1.094-1.064-1.254l-.018-.004zm19.25 3.668c-1.086.023-1.733 1.323-1.813 3.124H24V9.298a1.378 1.378 0 0 0-.342-.047Zm-1.862 3.632c-.1 1.756.86 3.239 2.204 3.634v-3.634z" },
    "substack": { name: "Substack", bg: "#FF6719", ink: "#111111", kind: "", path: "M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" },
    "thewashingtonpost": { name: "The Washington Post", bg: "#231F20", ink: "#ffffff", kind: "", path: "M24 15.366V6.922l-2.188-1.998-2.426 2.569V5.66h-.357v2.236l-.571.595V6.589L16.65 4.924l-2.164 2.212.261.261.547-.547.69.619v2.093h-.119c-1.046 0-1.689.714-1.689 1.689 0 .5.072.737.143.904h.238a1.033 1.033 0 011.023-.833h.404v3.782c-1.26.428-1.998 1.522-2.14 3.02l.166.096c.57-.69 1.308-1.118 1.974-1.284v5.209l.048.023 2.26-2.069 1.07 1 .047-.025v-4.043c.476.142.904.475 1.213.904zm-2.426.523c-.571-.57-1.26-.88-2.165-.999V7.85l1.023-1.095 1.142 1.047zm-2.545 4.4l-.571-.523V8.825l.57-.571zm-5.78-6.017V7.04L11.06 4.9 8.8 7.255 6.399 4.9 4.115 7.302v-.785c0-2.021-1.26-1.688-1.26-2.997 0-.832.523-1.237 1.165-1.546l-.143-.142C1.927 2.522.88 3.544.88 4.662c0 1 .761 1.047.761 2.212v2.973C.214 9.847 0 11.18 0 11.703c0 .309.048.594.095.737h.19c.072-.404.31-.69.81-.69h.546v3.806l2.807 2.426 2.07-2.33 2.71 2.33zm-2.45 1.879l-1.927-1.642V7.73l.833-.832 1.094 1.094zm-4.424-.904l-.595.69-1.665-1.428V7.802l.904-.928L6.375 8.23Z" },
    "evernote": { name: "Evernote", bg: "#00A82D", ink: "#111111", kind: "", path: "M8.222 5.393c0 .239-.02.637-.256.895-.257.24-.652.259-.888.259H4.552c-.73 0-1.165 0-1.46.04-.159.02-.356.1-.455.14-.04.019-.04 0-.02-.02L8.38.796c.02-.02.04-.02.02.02-.04.099-.118.298-.138.457-.04.298-.04.736-.04 1.472v2.647zm5.348 17.869c-.67-.438-1.026-1.015-1.164-1.373a2.924 2.924 0 01-.217-1.095 3.007 3.007 0 013-3.004c.493 0 .888.398.888.895a.88.88 0 01-.454.776c-.099.06-.237.1-.336.12-.098.02-.473.06-.65.218-.198.16-.356.418-.356.697 0 .298.118.577.316.776.355.358.829.557 1.342.557a2.436 2.436 0 002.427-2.447c0-1.214-.809-2.29-1.875-2.766-.158-.08-.414-.14-.651-.2a8.04 8.04 0 00-.592-.1c-.829-.1-2.901-.755-3.04-2.605 0 0-.611 2.785-1.835 3.54-.118.06-.276.12-.454.16-.177.04-.374.06-.434.06-1.993.12-4.105-.517-5.565-2.03 0 0-.987-.815-1.5-3.103-.118-.558-.355-1.553-.493-2.488-.06-.338-.08-.597-.099-.836 0-.975.592-1.631 1.342-1.73h4.026c.69 0 1.086-.18 1.342-.42.336-.317.415-.775.415-1.312V1.354C9.05.617 9.703 0 10.669 0h.474c.197 0 .434.02.651.04.158.02.296.06.533.12 1.204.298 1.46 1.532 1.46 1.532s2.27.398 3.415.597c1.085.199 3.77.378 4.282 3.104 1.204 6.487.474 12.775.415 12.775-.849 6.129-5.901 5.83-5.901 5.83a4.1 4.1 0 01-2.428-.736zm4.54-13.034c-.652-.06-1.204.2-1.402.697-.04.1-.079.219-.059.278.02.06.06.08.099.1.237.12.631.179 1.204.239.572.06.967.1 1.223.06.04 0 .08-.02.119-.08.04-.06.02-.18.02-.28-.06-.536-.553-.934-1.204-1.014z" },
    "todoist": { name: "Todoist", bg: "#E44332", ink: "#111111", kind: "", path: "M21 0H3C1.35 0 0 1.35 0 3v3.858s3.854 2.24 4.098 2.38c.31.18.694.177 1.004 0 .26-.147 8.02-4.608 8.136-4.675.279-.161.58-.107.748-.01.164.097.606.348.84.48.232.134.221.502.013.622l-9.712 5.59c-.346.2-.69.204-1.048.002C3.478 10.907.998 9.463 0 8.882v2.02l4.098 2.38c.31.18.694.177 1.004 0 .26-.147 8.02-4.609 8.136-4.676.279-.16.58-.106.748-.008.164.096.606.347.84.48.232.133.221.5.013.62-.208.121-9.288 5.346-9.712 5.59-.346.2-.69.205-1.048.002C3.478 14.951.998 13.506 0 12.926v2.02l4.098 2.38c.31.18.694.177 1.004 0 .26-.147 8.02-4.609 8.136-4.676.279-.16.58-.106.748-.009.164.097.606.348.84.48.232.133.221.502.013.622l-9.712 5.59c-.346.199-.69.204-1.048.001C3.478 18.994.998 17.55 0 16.97V21c0 1.65 1.35 3 3 3h18c1.65 0 3-1.35 3-3V3c0-1.65-1.35-3-3-3z" },
    "box": { name: "Box", bg: "#0061D5", ink: "#ffffff", kind: "", path: "M.959 5.523c-.54 0-.959.42-.959.899v7.549a4.59 4.59 0 004.613 4.494 4.717 4.717 0 004.135-2.457c.779 1.438 2.337 2.457 4.074 2.457 2.577 0 4.674-2.037 4.674-4.613.06-2.457-2.037-4.495-4.613-4.495-1.738 0-3.295.959-4.074 2.397-.78-1.438-2.338-2.397-4.135-2.397-1.079 0-2.038.36-2.817.899V6.422a.92.92 0 00-.898-.899zM17.602 9.26a.95.95 0 00-.704.158c-.36.3-.479.899-.18 1.318l2.397 3.116-2.396 3.115c-.3.42-.24.96.18 1.26.419.3 1.016.298 1.316-.122l2.039-2.636 2.096 2.697c.3.36.899.419 1.318.12.36-.3.42-.84.121-1.259l-2.338-3.115 2.338-3.057c.3-.419.298-1.018-.121-1.318-.48-.3-1.019-.24-1.318.18l-2.096 2.576-2.04-2.695c-.149-.18-.373-.3-.612-.338zM4.613 11.154c1.558 0 2.817 1.26 2.817 2.758 0 1.558-1.259 2.756-2.817 2.756-1.558 0-2.816-1.198-2.816-2.756 0-1.498 1.258-2.758 2.816-2.758zm8.27 0c1.558 0 2.816 1.26 2.816 2.758-.06 1.558-1.318 2.756-2.816 2.756-1.558 0-2.817-1.198-2.817-2.756 0-1.498 1.259-2.758 2.817-2.758Z" },
    "protonvpn": { name: "Proton VPN", bg: "#66DEB1", ink: "#111111", kind: "", path: "m10.176 20.058.858-1.28 6.513-9.838c.57-.86.026-2.014-1.005-2.131L.378 4.95l8.373 15.055a.84.84 0 0 0 1.424.052h.001zM23.586 7.14l-9.662 14.61c-1.036 1.567-3.38 1.478-4.293-.162l-.093-.168c.3-.01.594-.086.855-.235a1.85 1.85 0 0 0 .612-.57l.86-1.28 6.516-9.844c.46-.694.525-1.56.173-2.314a2.375 2.375 0 0 0-1.899-1.364L.493 3.956l-.476-.054C-.163 2.392 1.101.95 2.784 1.143l18.991 2.16c1.856.21 2.835 2.289 1.812 3.838z" },
    "expressvpn": { name: "ExpressVPN", bg: "#DA3940", ink: "#ffffff", kind: "", path: "M11.705 2.349a4.874 4.874 0 00-4.39 2.797L6.033 7.893h14.606c.41 0 .692.308.692.668 0 .359-.282.666-.692.666H2.592L0 14.772h2.824c-.796 1.72-1.002 2.567-1.002 3.26 0 2.105 1.72 3.62 4.416 3.62h8.239c1.771 0 3.337-1.412 3.337-3.03 0-1.411-1.206-2.515-2.772-2.515H5.596c-.873 0-1.284-.59-.924-1.335h11.859c4.004 0 7.469-3.029 7.469-6.802 0-3.183-2.618-5.621-6.16-5.621z" },
    "surfshark": { name: "Surfshark", bg: "#1EBFBF", ink: "#111111", kind: "", path: "M11.47 0C7.815.2 6.3 2.293 5.872 3.43c-1.615 4.866-3.127 14.325-3.33 15.662-.201 1.31-.228 2.119-.228 2.119 0 .328.026.705.102 1.059.454 1.286 1.792 2.37 4.768 1.287a192.353 192.353 0 0 0 9.533-4.44c1.387-.807 3.227-2.32 4.236-4.312.404-.807.682-1.716.733-2.65v-.452c-.026-2.295-.052-4.692-.204-7.013 0 0-.125-1.488-.2-2.017-.076-.53-.177-.733-.177-.733C20.626.906 19.693.38 18.71.126 18.23.026 17.7.024 17.095 0Zm4.692 4.44h.252c.277 0 .48.2.48.452V6.53c0 .252-.203.455-.48.455h-.252c-1.589 0-2.875 1.26-2.875 2.8v2.498c0 2.976-2.472 5.37-5.498 5.37h-.254c-.277 0-.478-.2-.478-.452v-1.64c0-.253.226-.454.478-.454h.254c1.589 0 2.875-1.262 2.875-2.8V9.81c0-2.977 2.472-5.373 5.498-5.373z" },
    "privateinternetaccess": { name: "Private Internet Access", bg: "#1E811F", ink: "#ffffff", kind: "", path: "M10.8078 5.7639a.812.812 0 1 0-.812.812.8115.8115 0 0 0 .812-.812m3.196-.8115a.812.812 0 1 0 .8114.8115.812.812 0 0 0-.8115-.8115m-.8757 2.1535a1.686 1.686 0 0 1-2.2571 0 .2106.2106 0 0 0-.2855.3092 2.0645 2.0645 0 0 0 2.8298 0 .2108.2108 0 1 0-.2866-.3092M11.9473 0C7.9939 0 4.789 3.2048 4.789 7.1582V8.543c0 .0084.0016.0202.002.0293-.7826.1443-1.3781.8232-1.3888 1.6464a2.3927 2.3927 0 0 0-.33 1.2208v9.1777a2.4154 2.4154 0 0 0 1.7851 2.3281A1.7667 1.7667 0 0 0 6.4727 24h2.0058a1.7627 1.7627 0 0 0 1.5762-.9668h3.6816c.3009.5943.9101.9678 1.5762.9668h2.0078a1.7718 1.7718 0 0 0 1.5899-1c1.1652-.1914 2.02-1.2 2.0175-2.3809v-9.1777a2.4275 2.4275 0 0 0-.3144-1.1973v-.0098c-.001-.7739-.5211-1.423-1.2305-1.625V7.1582C19.3828 3.2048 16.1761 0 12.2227 0Zm.0312 2.5586h.2149c2.4754 0 4.4824 2.005 4.4824 4.4805V8.543H15.668a1.6666 1.6666 0 0 0-1.1739.4804H9.5273a1.675 1.675 0 0 0-1.1836-.4804h-.8476V7.039c0-2.4754 2.007-4.4804 4.4824-4.4804zm.0254 9.4922v.0039a1.9739 1.9739 0 0 1 1.1055 3.6035.3126.3126 0 0 0-.1328.2988l.4863 3.2969a.307.307 0 0 1-.0703.2461.3137.3137 0 0 1-.2344.1074h-2.3164a.3097.3097 0 0 1-.3047-.3535l.4844-3.2969a.2934.2934 0 0 0-.129-.2949 1.975 1.975 0 0 1 .8848-3.5976 2.176 2.176 0 0 1 .2266-.0137z" },
    "nextdns": { name: "NextDNS", bg: "#007BFF", ink: "#111111", kind: "", path: "m22.195 6.512-.001-.019c-.01-.23-.017-.474-.022-.746a2.543 2.543 0 0 0-2.395-2.492c-2.759-.154-4.894-1.053-6.717-2.831l-.016-.015a1.536 1.536 0 0 0-2.087 0l-.016.015C9.117 2.202 6.982 3.101 4.223 3.256a2.543 2.543 0 0 0-2.395 2.492c-.004.269-.011.513-.022.745l-.001.044c-.053 2.813-.12 6.315 1.052 9.494.644 1.748 1.619 3.267 2.899 4.516 1.458 1.422 3.367 2.552 5.674 3.356.075.026.153.048.233.063a1.668 1.668 0 0 0 .675 0c.079-.015.158-.037.233-.063 2.305-.806 4.212-1.936 5.668-3.358 1.28-1.25 2.255-2.769 2.9-4.518 1.176-3.188 1.109-6.696 1.056-9.515Z" },
    "hey": { name: "HEY", bg: "#5522FA", ink: "#ffffff", kind: "", path: "M19.57 6.698a5.724 5.724 0 00-2.644 1.572c-.84-2.952-2.65-7.42-4.415-8.15a1.283 1.283 0 00-1.181.05c-1.104.643-1.823 2.709-1.194 6.624C7.71 2.353 6.863 2.36 6.472 2.353a.956.956 0 00-.873.597c-.263.584-.79 2.406.494 6.327C4.547 7.16 4.072 6.89 3.526 6.917a.969.969 0 00-.821.557c-.463.873-.41 3.068 1.027 6.34a2.946 2.946 0 00-1.773-.73 1.06 1.06 0 00-.853.544c-.584 1.073.642 4.083 2.157 6.124C4.49 21.427 6.947 24 10.515 24a8.047 8.047 0 001.489-.141.654.654 0 00-.25-1.284c-2.965.578-5.2-1.052-6.553-2.515-2.021-2.19-2.908-4.82-2.959-5.622.424.173 1.644.892 4.018 3.934a.65.65 0 001.059-.757c-3.337-5.066-3.664-8.132-3.555-9.166.982 1 3.433 4.671 5.28 7.445a.642.642 0 00.88.199.642.642 0 00.238-.873C6.312 8.16 6.446 4.952 6.67 3.874c.577.584 2.11 2.618 5.34 9.626a.642.642 0 00.84.327.642.642 0 00.366-.827c-3.132-8.504-1.772-11.385-1.252-11.712.674 0 2.567 3.247 3.748 7.502.07.263.141.52.205.77a4.094 4.094 0 00-.385.924c-.64 2.355-1.283 7.7-.045 9.17a1.194 1.194 0 001.04.444 1.688 1.688 0 001.232-.757c1.15-1.675.475-5.879-.443-9.557a4.832 4.832 0 012.567-1.84 1.283 1.283 0 011.284.307c.526.59 1.445 2.798-1.34 10.583a.654.654 0 001.231.436c2.22-6.206 2.568-10.204 1.084-11.886A2.528 2.528 0 0019.57 6.7zm-2.888 11.918a.41.41 0 01-.218.186c-.48-.571-.48-3.953.045-6.727.995 4.795.417 6.2.173 6.54z" },
    "squarespace": { name: "Squarespace", bg: "#000000", ink: "#ffffff", kind: "", path: "M22.655 8.719c-1.802-1.801-4.726-1.801-6.564 0l-7.351 7.35c-.45.45-.45 1.2 0 1.65.45.449 1.2.449 1.65 0l7.351-7.351c.899-.899 2.362-.899 3.264 0 .9.9.9 2.364 0 3.264l-7.239 7.239c.9.899 2.362.899 3.263 0l5.589-5.589c1.836-1.838 1.836-4.763.037-6.563zm-2.475 2.437c-.451-.45-1.201-.45-1.65 0l-7.354 7.389c-.9.899-2.361.899-3.262 0-.45-.45-1.2-.45-1.65 0s-.45 1.2 0 1.649c1.801 1.801 4.726 1.801 6.564 0l7.351-7.35c.449-.487.449-1.239.001-1.688zm-2.439-7.35c-1.801-1.801-4.726-1.801-6.564 0l-7.351 7.351c-.45.449-.45 1.199 0 1.649s1.2.45 1.65 0l7.395-7.351c.9-.899 2.371-.899 3.27 0 .451.45 1.201.45 1.65 0 .421-.487.421-1.199-.029-1.649h-.021zm-2.475 2.437c-.45-.45-1.2-.45-1.65 0l-7.351 7.389c-.899.9-2.363.9-3.265 0-.9-.899-.9-2.363 0-3.264l7.239-7.239c-.9-.9-2.362-.9-3.263 0L1.35 8.719c-1.8 1.8-1.8 4.725 0 6.563 1.801 1.801 4.725 1.801 6.564 0l7.35-7.351c.451-.488.451-1.238 0-1.688h.002z" },
    "wix": { name: "Wix", bg: "#0C6EFC", ink: "#ffffff", kind: "", path: "m0 7.354 2.113 9.292h.801a1.54 1.54 0 0 0 1.506-1.218l1.351-6.34a.171.171 0 0 1 .167-.137c.08 0 .15.058.167.137l1.352 6.34a1.54 1.54 0 0 0 1.506 1.218h.805l2.113-9.292h-.565c-.62 0-1.159.43-1.296 1.035l-1.26 5.545-1.106-5.176a1.76 1.76 0 0 0-2.19-1.324c-.639.176-1.113.716-1.251 1.365l-1.094 5.127-1.26-5.537A1.33 1.33 0 0 0 .563 7.354H0zm13.992 0a.951.951 0 0 0-.951.95v8.342h.635a.952.952 0 0 0 .951-.95V7.353h-.635zm1.778 0 3.158 4.66-3.14 4.632h1.325c.368 0 .712-.181.918-.486l1.756-2.59a.12.12 0 0 1 .197 0l1.754 2.59c.206.305.55.486.918.486h1.326l-3.14-4.632L24 7.354h-1.326c-.368 0-.712.181-.918.486l-1.772 2.617a.12.12 0 0 1-.197 0L18.014 7.84a1.108 1.108 0 0 0-.918-.486H15.77z" },
    "godaddy": { name: "GoDaddy", bg: "#1BDBDB", ink: "#111111", kind: "", path: "M20.702 2.29c-2.494-1.554-5.778-1.187-8.706.654C9.076 1.104 5.79.736 3.3 2.29c-3.941 2.463-4.42 8.806-1.07 14.167 2.47 3.954 6.333 6.269 9.77 6.226 3.439.043 7.301-2.273 9.771-6.226 3.347-5.361 2.872-11.704-1.069-14.167zM4.042 15.328a12.838 12.838 0 01-1.546-3.541 10.12 10.12 0 01-.336-3.338c.15-1.98.956-3.524 2.27-4.345 1.315-.822 3.052-.87 4.903-.137.281.113.556.24.825.382A15.11 15.11 0 007.5 7.54c-2.035 3.255-2.655 6.878-1.945 9.765a13.247 13.247 0 01-1.514-1.98zm17.465-3.541a12.866 12.866 0 01-1.547 3.54 13.25 13.25 0 01-1.513 1.984c.635-2.589.203-5.76-1.353-8.734a.39.39 0 00-.563-.153l-4.852 3.032a.397.397 0 00-.126.546l.712 1.139a.395.395 0 00.547.126l3.145-1.965c.101.306.203.606.28.916.296 1.086.41 2.214.335 3.337-.15 1.982-.956 3.525-2.27 4.347a4.437 4.437 0 01-2.25.65h-.101a4.432 4.432 0 01-2.25-.65c-1.314-.822-2.121-2.365-2.27-4.347-.074-1.123.039-2.251.335-3.337a13.212 13.212 0 014.05-6.482 10.148 10.148 0 012.849-1.765c1.845-.733 3.586-.685 4.9.137 1.316.822 2.122 2.365 2.271 4.345a10.146 10.146 0 01-.33 3.334z" },
    "wordpress": { name: "WordPress", bg: "#21759B", ink: "#ffffff", kind: "", path: "M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0" },
    "vercel": { name: "Vercel", bg: "#000000", ink: "#ffffff", kind: "", path: "m12 1.608 12 20.784H0Z" },
    "netlify": { name: "Netlify", bg: "#00C7B7", ink: "#111111", kind: "", path: "M6.49 19.04h-.23L5.13 17.9v-.23l1.73-1.71h1.2l.15.15v1.2L6.5 19.04ZM5.13 6.31V6.1l1.13-1.13h.23L8.2 6.68v1.2l-.15.15h-1.2L5.13 6.31Zm9.96 9.09h-1.65l-.14-.13v-3.83c0-.68-.27-1.2-1.1-1.23-.42 0-.9 0-1.43.02l-.07.08v4.96l-.14.14H8.9l-.13-.14V8.73l.13-.14h3.7a2.6 2.6 0 0 1 2.61 2.6v4.08l-.13.14Zm-8.37-2.44H.14L0 12.82v-1.64l.14-.14h6.58l.14.14v1.64l-.14.14Zm17.14 0h-6.58l-.14-.14v-1.64l.14-.14h6.58l.14.14v1.64l-.14.14ZM11.05 6.55V1.64l.14-.14h1.65l.14.14v4.9l-.14.14h-1.65l-.14-.13Zm0 15.81v-4.9l.14-.14h1.65l.14.13v4.91l-.14.14h-1.65l-.14-.14Z" },
    "vultr": { name: "Vultr", bg: "#007BFC", ink: "#111111", kind: "", path: "M8.36 2.172A1.194 1.194 0 007.348 1.6H1.2A1.2 1.2 0 000 2.8a1.211 1.211 0 00.182.64l11.6 18.4a1.206 1.206 0 002.035 0l3.075-4.874a1.229 1.229 0 00.182-.64 1.211 1.211 0 00-.182-.642zm10.349 8.68a1.206 1.206 0 002.035 0L21.8 9.178l2.017-3.2a1.211 1.211 0 00.183-.64 1.229 1.229 0 00-.183-.64l-1.6-2.526a1.206 1.206 0 00-1.016-.571h-6.148a1.2 1.2 0 00-1.201 1.2 1.143 1.143 0 00.188.64z" },
    "ovh": { name: "OVH", bg: "#123F6D", ink: "#ffffff", kind: "", path: "M19.881 10.095l2.563-4.45C23.434 7.389 24 9.404 24 11.555c0 2.88-1.017 5.523-2.71 7.594h-6.62l2.04-3.541h-2.696l3.176-5.513h2.691zm-2.32-5.243L9.333 19.14l.003.009H2.709C1.014 17.077 0 14.435 0 11.555c0-2.152.57-4.17 1.561-5.918L5.855 13.1 10.6 4.852h6.961z" },
    "wasabi": { name: "Wasabi", bg: "#01CD3E", ink: "#111111", kind: "", path: "M20.483 3.517A11.91 11.91 0 0 0 12 0a11.91 11.91 0 0 0-8.483 3.517A11.91 11.91 0 0 0 0 12a11.91 11.91 0 0 0 3.517 8.483A11.91 11.91 0 0 0 12 24a11.91 11.91 0 0 0 8.483-3.517A11.91 11.91 0 0 0 24 12a11.91 11.91 0 0 0-3.517-8.483Zm1.29 7.387-5.16-4.683-5.285 4.984-2.774 2.615V9.932l4.206-3.994 3.146-2.969c3.163 1.379 5.478 4.365 5.867 7.935zm-.088 2.828a10.632 10.632 0 0 1-1.025 2.951l-2.952-2.668v-3.87Zm-8.183-11.47-2.227 2.103-2.739 2.598v-4.17A9.798 9.798 0 0 1 12 2.155c.513 0 1.007.035 1.502.106zM6.398 13.891l-4.083-3.658a9.744 9.744 0 0 1 1.078-2.987L6.398 9.95zm0-9.968v3.129l-1.75-1.573a8.623 8.623 0 0 1 1.75-1.556Zm-4.189 9.102 5.284 4.736 5.302-4.983 2.74-2.598v3.817l-7.423 7.016a9.823 9.823 0 0 1-5.903-7.988Zm8.306 8.695 5.02-4.754v4.206a9.833 9.833 0 0 1-3.553.654c-.495 0-.99-.035-1.467-.106zm7.176-1.714v-3.11l1.714 1.555a9.604 9.604 0 0 1-1.714 1.555z" },
    "googlecloud": { name: "Google Cloud", bg: "#4285F4", ink: "#111111", kind: "", path: "M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a6.717 6.717 0 0 0 4.077 1.356h5.173l.03.03h5.192c6.687.053 9.376-8.605 3.835-12.35a9.365 9.365 0 0 0-2.821-4.552l-.043.043.006-.05A9.344 9.344 0 0 0 12.19 2.38zm-.358 4.146c1.244-.04 2.518.368 3.486 1.15a5.186 5.186 0 0 1 1.862 4.078v.518c3.53-.07 3.53 5.262 0 5.193h-5.193l-.008.009v-.04H6.785a2.59 2.59 0 0 1-1.067-.23h.001a2.597 2.597 0 1 1 3.437-3.437l3.013-3.012A6.747 6.747 0 0 0 8.11 8.24c.018-.01.04-.026.054-.023a5.186 5.186 0 0 1 3.67-1.69z" },
    "fitbit": { name: "Fitbit", bg: "#00B0B9", ink: "#111111", kind: "", path: "M13.298 1.825c0 .976-.81 1.785-1.786 1.785-.972 0-1.784-.81-1.784-1.785 0-.973.813-1.785 1.784-1.785.976 0 1.786.813 1.786 1.785zm-1.786 3.243c-1.052 0-1.863.81-1.863 1.866 0 1.053.81 1.865 1.865 1.865 1.053 0 1.865-.811 1.865-1.865s-.825-1.866-1.875-1.866h.008zm0 5.029c-1.052 0-1.945.891-1.945 1.945s.894 1.945 1.947 1.945 1.946-.891 1.946-1.945-.894-1.945-1.946-1.945h-.002zm0 5.107c-1.052 0-1.863.81-1.863 1.864s.81 1.866 1.865 1.866c1.053 0 1.865-.811 1.865-1.866 0-.972-.825-1.864-1.875-1.864h.008zm0 5.191c-.972 0-1.784.809-1.784 1.784 0 .97.813 1.781 1.784 1.781.977 0 1.786-.809 1.786-1.784 0-.973-.81-1.781-1.786-1.781zM16.46 4.823c-1.136 0-2.108.977-2.108 2.111 0 1.134.973 2.107 2.108 2.107 1.135 0 2.106-.975 2.106-2.107 0-1.135-.972-2.109-2.106-2.109v-.002zm0 5.03c-1.216 0-2.19.973-2.19 2.19 0 1.216.975 2.187 2.19 2.187 1.215 0 2.189-.971 2.189-2.189 0-1.216-.974-2.188-2.189-2.188zm0 5.108c-1.136 0-2.108.976-2.108 2.107 0 1.135.973 2.109 2.108 2.109 1.135 0 2.106-.976 2.106-2.109s-.971-2.107-2.106-2.107zm5.106-5.353c-1.296 0-2.43 1.055-2.43 2.434 0 1.297 1.051 2.433 2.43 2.433 1.381 0 2.434-1.065 2.434-2.444-.082-1.382-1.135-2.431-2.434-2.431v.008zM6.486 5.312c-.892 0-1.62.73-1.62 1.623 0 .891.729 1.62 1.62 1.62.893 0 1.619-.729 1.619-1.62 0-.893-.727-1.62-1.619-1.62v-.003zm0 5.027c-.973 0-1.703.729-1.703 1.703 0 .975.721 1.703 1.695 1.703s1.695-.73 1.695-1.703c0-.975-.735-1.703-1.71-1.703h.023zm0 5.107c-.892 0-1.62.731-1.62 1.62 0 .895.729 1.623 1.62 1.623.893 0 1.619-.735 1.619-1.635s-.727-1.62-1.619-1.62v.012zm-5.025-4.863c-.813 0-1.461.646-1.461 1.459 0 .81.648 1.459 1.46 1.459.81 0 1.459-.648 1.459-1.459s-.648-1.459-1.458-1.459z" },
    "garmin": { name: "Garmin", bg: "#000000", ink: "#ffffff", kind: "", letters: "G" },
    "postmates": { name: "Postmates", bg: "#FFDF18", ink: "#111111", kind: "", path: "M2.545 14.954l.44-1.284-1.138.692-1.08-.88.342 1.35-1.109.74 1.35.143.396 1.338.492-1.263 1.352.087zm5.308-2.61l-1.14.692-1.08-.88.342 1.349-1.108.74 1.35.144.396 1.336.493-1.261 1.352.087-1.046-.924zm-1.328 4.864l-1.139.692-1.08-.881.342 1.35-1.108.74 1.35.144.396 1.338.492-1.263 1.353.087-1.046-.924zM15.95 6.744l.72.041a.123.122 0 0 0 .092-.032l1.78-1.67a.032.032 0 0 0-.02-.056l-.7-.04a.189.189 0 0 0-.14.05l-1.754 1.646a.035.035 0 0 0 .022.06zm7.55 3.377a3.1 3.098 0 0 0-4.976-.342l-1.108-.83c.277-.113.857-.368.896-.525.022-.093-.273-.158-.727-.187l2.079-1.896a.047.047 0 0 0 .009-.053l-.529-.996a.04.04 0 0 0-.063-.01l-2.163 1.97c-.646 0-1.796.085-2.127-.123-.528-.333-.59-.822-.785-.997-.195-.176-.415-.197-.462-.346a.015.015 0 0 1 .011-.019c.102-.026.67-.186.8-.58.129-.396-.135-.932-.18-1.016a.018.018 0 0 1 0-.02l.604-.527a.018.018 0 0 0-.013-.03l-.886.108a.015.015 0 0 1-.015 0c-.047-.062-.4-.484-1.121-.189-.842.34-.687 1.068-.687 1.068.112.753.374.902.8 1.148.012 0 .017.02 0 .027-.274.228-3.035 2.494-5.585 3.378a.05.05 0 0 0 0 .093c.738.32 2.952.147 3.606-.232a.016.016 0 0 1 .025.018c-.072.273-.458 1.873.147 2.37l.034.026-.82.578a.21.21 0 0 0 .147.38l.422-.047a1.216 1.216 0 0 0 .725-.34l.148-.14 1.193.886-.158 1.261a3.1 3.098 0 1 0 2.56 1.623l.305-.195a.748.748 0 0 0 1.218-.756l1.262-.37a.205.205 0 0 0 .147-.24l-.008-.041a.207.207 0 0 0-.203-.164h-1.071a.018.018 0 0 1-.015-.01l-.322-.727.64-3.762 1.034.767a3.1 3.098 0 1 0 5.224 0zm-8.594-2.228l1.46-.025.192.361c-.338.012-.69.039-1.033.082-.247.03-.545-.287-.634-.387a.02.02 0 0 1 .015-.03zm-2.214 2.185c.122-.204.831-1.384.92-1.787a.018.018 0 0 1 .03-.007c.471.55 1.468.866 1.545.885a.009.009 0 0 0 .008 0l1.28-.394.287.213-1.34 1.229a.918.918 0 0 0-.52-.228c-.77-.098-1.975.076-2.194.11a.016.016 0 0 1-.006-.021zm3.31 4.029a.76.76 0 0 0-.249.074l-.915-.7a.015.015 0 0 1 0-.019l.458-.948a.016.016 0 0 1 .03 0l.752 1.18zm-1.942-1.025l-.626-.468 1.2-1.1zm0-1.623l-.974.894-.977-.727a11.265 11.258 0 0 0 1.97-.16zm-.778 1.553l.643.478-.077.211a.286.286 0 0 0 .172.369l1.34.488.04.03a.753.752 0 0 0-.019.473l-.295.192a3.09 3.088 0 0 0-1.919-1.217zm-.208 1.661a2.46 2.458 0 0 1 1.465.925l-1.717 1.092zm.822 4.48a2.46 2.46 0 1 1-1.235-4.53l-.309 2.456a.214.214 0 0 0 .096.203.207.207 0 0 0 .223 0l2.089-1.328a2.462 2.46 0 0 1-.866 3.198zm1.83-8.045a.01.01 0 0 1 0-.01 1.329 1.328 0 0 0-.063-.518l1.133-1.033-.49 2.875zm6.486 2.751a2.46 2.458 0 0 1-3.418-3.362l1.95 1.452a.207.207 0 0 0 .237.008.196.196 0 0 0 .054-.05.208.208 0 0 0-.043-.295l-1.953-1.45a2.385 2.384 0 0 1 .526-.443 2.46 2.46 0 1 1 2.644 4.147Z" },
    "macys": { name: "Macy's", bg: "#E21A2C", ink: "#ffffff", kind: "", path: "M12.015.624L9.19 9.293H0l7.445 5.384-2.819 8.673L12 17.986l7.422 5.393-2.835-8.713L24 9.292h-9.162L12.015.622v.002z" },
    "nike": { name: "Nike", bg: "#111111", ink: "#ffffff", kind: "", path: "M24 7.8L6.442 15.276c-1.456.616-2.679.925-3.668.925-1.12 0-1.933-.392-2.437-1.177-.317-.504-.41-1.143-.28-1.918.13-.775.476-1.6 1.036-2.478.467-.71 1.232-1.643 2.297-2.8a6.122 6.122 0 00-.784 1.848c-.28 1.195-.028 2.072.756 2.632.373.261.886.392 1.54.392.522 0 1.11-.084 1.764-.252L24 7.8z" },
    "adidas": { name: "Adidas", bg: "#000000", ink: "#ffffff", kind: "", path: "m24 19.535-8.697-15.07-4.659 2.687 7.145 12.383Zm-8.287 0L9.969 9.59 5.31 12.277l4.192 7.258ZM4.658 14.723l2.776 4.812H1.223L0 17.41Z" },
    "expedia": { name: "Expedia", bg: "#191E3B", ink: "#ffffff", kind: "", path: "M19.067 0H4.933A4.94 4.94 0 0 0 0 4.933v14.134A4.932 4.932 0 0 0 4.933 24h14.134A4.932 4.932 0 0 0 24 19.067V4.933C24.01 2.213 21.797 0 19.067 0ZM7.336 19.341c0 .19-.148.337-.337.337h-2.33a.333.333 0 0 1-.337-.337v-2.33c0-.189.148-.336.337-.336H7c.19 0 .337.147.337.337zm12.121-1.486-2.308 2.298c-.169.168-.422.053-.422-.2V9.57l-6.44 6.44a.533.533 0 0 1-.421.17H8.169a.32.32 0 0 1-.338-.338v-1.697c0-.2.053-.316.169-.422l6.44-6.44H4.058c-.253 0-.369-.253-.2-.421l2.297-2.309c.137-.137.285-.232.517-.232H18.15c.854 0 1.539.686 1.539 1.54v11.478c-.01.231-.095.368-.232.516z" },
    "bookingdotcom": { name: "Booking.com", bg: "#003A9A", ink: "#ffffff", kind: "", path: "M24 0H0v24h24ZM8.575 6.563h2.658c2.108 0 3.473 1.15 3.473 2.898 0 1.15-.575 1.82-.91 2.108l-.287.263.335.192c.815.479 1.318 1.389 1.318 2.395 0 1.988-1.51 3.257-3.857 3.257H7.449V7.713c0-.623.503-1.126 1.126-1.15zm1.7 1.868c-.479.024-.694.264-.694.79v1.893h1.676c.958 0 1.294-.743 1.294-1.365 0-.815-.503-1.318-1.318-1.318zm-.096 4.36c-.407.071-.598.31-.598.79v2.251h1.868c.934 0 1.509-.55 1.509-1.533 0-.934-.599-1.509-1.51-1.509zm7.737 2.394c.743 0 1.341.599 1.341 1.342a1.34 1.34 0 0 1-1.341 1.341 1.355 1.355 0 0 1-1.341-1.341c0-.743.598-1.342 1.34-1.342z" },
    "hotelsdotcom": { name: "Hotels.com", bg: "#EF3346", ink: "#111111", kind: "", path: "M19.064 0H4.936a4.937 4.937 0 0 0-4.93 4.93V19.06A4.94 4.94 0 0 0 4.935 24h14.128a4.926 4.926 0 0 0 4.93-4.941V4.93A4.93 4.93 0 0 0 19.065 0zM8.55 10.63v2.329a.32.32 0 0 1-.337.337H5.884a.32.32 0 0 1-.337-.337V10.63c0-.2.137-.337.337-.337h2.34c.2 0 .336.137.336.337h-.01zm5.162 7.491a.32.32 0 0 1-.337.337h-2.328a.32.32 0 0 1-.337-.337v-2.328c0-.2.136-.337.337-.337h2.328c.19 0 .337.136.337.337v2.328zm0-5.162a.32.32 0 0 1-.337.337h-2.328a.32.32 0 0 1-.337-.337V10.63c0-.2.136-.337.337-.337h2.328c.2 0 .337.137.337.337v2.329zm5.974 4.372a.654.654 0 0 1-.22.516l-2.308 2.297c-.18.168-.432.052-.432-.2V7.28H4.062c-.253 0-.369-.264-.2-.432L6.169 4.55c.137-.147.274-.232.506-.232h11.473c.854 0 1.538.685 1.538 1.539V17.33z" },
    "tripadvisor": { name: "Tripadvisor", bg: "#34E0A1", ink: "#111111", kind: "", path: "M12.006 4.295c-2.67 0-5.338.784-7.645 2.353H0l1.963 2.135a5.997 5.997 0 0 0 4.04 10.43 5.976 5.976 0 0 0 4.075-1.6L12 19.705l1.922-2.09a5.972 5.972 0 0 0 4.072 1.598 6 6 0 0 0 6-5.998 5.982 5.982 0 0 0-1.957-4.432L24 6.648h-4.35a13.573 13.573 0 0 0-7.644-2.353zM12 6.255c1.531 0 3.063.303 4.504.903C13.943 8.138 12 10.43 12 13.1c0-2.671-1.942-4.962-4.504-5.942A11.72 11.72 0 0 1 12 6.256zM6.002 9.157a4.059 4.059 0 1 1 0 8.118 4.059 4.059 0 0 1 0-8.118zm11.992.002a4.057 4.057 0 1 1 .003 8.115 4.057 4.057 0 0 1-.003-8.115zm-11.992 1.93a2.128 2.128 0 0 0 0 4.256 2.128 2.128 0 0 0 0-4.256zm11.992 0a2.128 2.128 0 0 0 0 4.256 2.128 2.128 0 0 0 0-4.256z" },
    "coursera": { name: "Coursera", bg: "#0056D2", ink: "#ffffff", kind: "", path: "M11.374 23.977c-4.183-.21-8.006-2.626-9.959-6.347-2.097-3.858-1.871-8.864.732-12.454C4.748 1.338 9.497-.698 14.281.23c4.583.857 8.351 4.494 9.358 8.911 1.122 4.344-.423 9.173-3.925 12.04-2.289 1.953-5.295 2.956-8.34 2.797zm7.705-8.05a588.737 588.737 0 0 0-3.171-1.887c-.903 1.483-2.885 2.248-4.57 1.665-2.024-.639-3.394-2.987-2.488-5.134.801-2.009 2.79-2.707 4.357-2.464a4.19 4.19 0 0 1 2.623 1.669c1.077-.631 2.128-1.218 3.173-1.855-2.03-3.118-6.151-4.294-9.656-2.754-3.13 1.423-4.89 4.68-4.388 7.919.54 3.598 3.73 6.486 7.716 6.404a7.664 7.664 0 0 0 6.404-3.563z" },
    "udemy": { name: "Udemy", bg: "#A435F0", ink: "#ffffff", kind: "", path: "M12 0L5.81 3.573v3.574l6.189-3.574 6.191 3.574V3.573zM5.81 10.148v8.144c0 1.85.589 3.243 1.741 4.234S10.177 24 11.973 24s3.269-.482 4.448-1.474c1.179-.991 1.768-2.439 1.768-4.314v-8.064h-3.242v7.85c0 2.036-1.509 3.055-2.948 3.055-1.428 0-2.947-.991-2.947-3.027v-7.878z" },
    "skillshare": { name: "Skillshare", bg: "#00FF84", ink: "#111111", kind: "", letters: "S" },
    "khanacademy": { name: "Khan Academy", bg: "#14BF96", ink: "#111111", kind: "", path: "M21.724 4.973L13.418.328a3.214 3.214 0 0 0-2.828 0L2.276 4.973A3.05 3.05 0 0 0 .862 7.371v9.256a3.05 3.05 0 0 0 1.414 2.4l8.306 4.645a3.214 3.214 0 0 0 2.828 0l8.314-4.645a3.05 3.05 0 0 0 1.414-2.4V7.373a3.05 3.05 0 0 0-1.414-2.4zM12 4.921a2.571 2.571 0 1 1 .001 5.143A2.571 2.571 0 0 1 12 4.92zm3.094 13.627a9.119 9.119 0 0 1-3.103.549 8.972 8.972 0 0 1-3.076-.55 8.493 8.493 0 0 1-5.486-7.987v-.857c4.646.017 8.074 3.823 8.074 8.51v.198h.926v-.197c0-4.688 3.445-8.51 8.056-8.51.026.29.043.582.086.856a8.502 8.502 0 0 1-5.477 7.988z" },
    "quizlet": { name: "Quizlet", bg: "#4255FF", ink: "#ffffff", kind: "", path: "M12.779.025a11.789 11.789 0 0 0-5.338.896A11.829 11.829 0 0 0 3.058 4.11 11.928 11.928 0 0 0 .427 14.363a11.92 11.92 0 0 0 2.3 4.921 11.842 11.842 0 0 0 4.24 3.378 11.783 11.783 0 0 0 10.533-.226.327.327 0 0 1 .331.018 9.136 9.136 0 0 0 5.197 1.545.332.332 0 0 0 .332-.332v-4.038a.334.334 0 0 0-.276-.331 4.732 4.732 0 0 1-1.106-.319.329.329 0 0 1-.191-.352.33.33 0 0 1 .05-.133 11.943 11.943 0 0 0 .772-11.871 11.87 11.87 0 0 0-4.042-4.628A11.793 11.793 0 0 0 12.765.018l.013.007h.001ZM4.843 11.898a7.24 7.24 0 0 1 1.205-4.005 7.18 7.18 0 0 1 3.215-2.657 7.133 7.133 0 0 1 7.815 1.558 7.239 7.239 0 0 1 1.555 7.854 7.202 7.202 0 0 1-2.643 3.234 7.147 7.147 0 0 1-9.049-.896 7.228 7.228 0 0 1-2.103-5.089l.005.001Z" },
    // More initials on their colours: insurers, banks and lenders, brokers, utilities, and the rest simple-icons has no mark for.
    "geico": { name: "GEICO", bg: "#004B8D", ink: "#ffffff", kind: "", letters: "G" },
    "statefarm": { name: "State Farm", bg: "#E31837", ink: "#ffffff", kind: "", letters: "SF" },
    "allstate": { name: "Allstate", bg: "#0033A0", ink: "#ffffff", kind: "", letters: "A" },
    "lemonade": { name: "Lemonade", bg: "#FF0083", ink: "#111111", kind: "", letters: "L" },
    "libertymutual": { name: "Liberty Mutual", bg: "#1A1446", ink: "#ffffff", kind: "", letters: "LM" },
    "nationwide": { name: "Nationwide", bg: "#0047BB", ink: "#ffffff", kind: "", letters: "N" },
    "farmers": { name: "Farmers Insurance", bg: "#003A70", ink: "#ffffff", kind: "", letters: "F" },
    "travelers": { name: "Travelers", bg: "#E01933", ink: "#ffffff", kind: "", letters: "T" },
    "metlife": { name: "MetLife", bg: "#0090DA", ink: "#111111", kind: "", letters: "M" },
    "prudential": { name: "Prudential", bg: "#001E60", ink: "#ffffff", kind: "", letters: "P" },
    "aetna": { name: "Aetna", bg: "#7D3F98", ink: "#ffffff", kind: "", letters: "A" },
    "cigna": { name: "Cigna", bg: "#0070CC", ink: "#ffffff", kind: "", letters: "C" },
    "unitedhealthcare": { name: "UnitedHealthcare", bg: "#002677", ink: "#ffffff", kind: "", letters: "U" },
    "kaiser": { name: "Kaiser Permanente", bg: "#0078B3", ink: "#ffffff", kind: "", letters: "KP" },
    "humana": { name: "Humana", bg: "#78BE20", ink: "#111111", kind: "", letters: "H" },
    "bluecross": { name: "Blue Cross Blue Shield", bg: "#0072CE", ink: "#ffffff", kind: "", letters: "BC" },
    "anthem": { name: "Anthem", bg: "#0079C2", ink: "#ffffff", kind: "", letters: "A" },
    "marcus": { name: "Marcus", bg: "#1F2A44", ink: "#ffffff", kind: "bank", letters: "M" },
    "santander": { name: "Santander", bg: "#EC0000", ink: "#ffffff", kind: "bank", letters: "S" },
    "bmo": { name: "BMO", bg: "#0079C1", ink: "#ffffff", kind: "bank", letters: "BMO" },
    "regions": { name: "Regions", bg: "#529E3C", ink: "#111111", kind: "bank", letters: "R" },
    "keybank": { name: "KeyBank", bg: "#CC0000", ink: "#ffffff", kind: "bank", letters: "K" },
    "huntington": { name: "Huntington", bg: "#4F9A27", ink: "#111111", kind: "bank", letters: "H" },
    "fifththird": { name: "Fifth Third", bg: "#00704A", ink: "#ffffff", kind: "bank", letters: "53" },
    "rocketmortgage": { name: "Rocket Mortgage", bg: "#C8102E", ink: "#ffffff", kind: "bank", letters: "R" },
    "mrcooper": { name: "Mr. Cooper", bg: "#F68D2E", ink: "#111111", kind: "bank", letters: "MC" },
    "nelnet": { name: "Nelnet", bg: "#00467F", ink: "#ffffff", kind: "bank", letters: "N" },
    "mohela": { name: "MOHELA", bg: "#0057A0", ink: "#ffffff", kind: "bank", letters: "M" },
    "affirm": { name: "Affirm", bg: "#4A4AF4", ink: "#ffffff", kind: "card", letters: "A" },
    "creditkarma": { name: "Credit Karma", bg: "#2BB673", ink: "#111111", kind: "", letters: "CK" },
    "betterment": { name: "Betterment", bg: "#1A5BDB", ink: "#ffffff", kind: "investment", letters: "B" },
    "wealthfront": { name: "Wealthfront", bg: "#4840BB", ink: "#ffffff", kind: "investment", letters: "W" },
    "empower": { name: "Empower", bg: "#002B49", ink: "#ffffff", kind: "investment", letters: "E" },
    "acorns": { name: "Acorns", bg: "#7CC243", ink: "#111111", kind: "investment", letters: "A" },
    "webull": { name: "Webull", bg: "#0E4AFF", ink: "#ffffff", kind: "investment", letters: "W" },
    "public": { name: "Public", bg: "#000000", ink: "#ffffff", kind: "investment", letters: "P" },
    "kraken": { name: "Kraken", bg: "#5741D9", ink: "#ffffff", kind: "investment", letters: "K" },
    "gemini": { name: "Gemini", bg: "#00DCFA", ink: "#111111", kind: "investment", letters: "G" },
    "cryptocom": { name: "Crypto.com", bg: "#002D74", ink: "#ffffff", kind: "investment", letters: "C" },
    "edwardjones": { name: "Edward Jones", bg: "#003A5D", ink: "#ffffff", kind: "investment", letters: "EJ" },
    "troweprice": { name: "T. Rowe Price", bg: "#00438C", ink: "#ffffff", kind: "investment", letters: "T" },
    "ameriprise": { name: "Ameriprise", bg: "#00319F", ink: "#ffffff", kind: "investment", letters: "A" },
    "tiaa": { name: "TIAA", bg: "#0059B3", ink: "#ffffff", kind: "investment", letters: "T" },
    "cox": { name: "Cox", bg: "#00A3E0", ink: "#111111", kind: "", letters: "C" },
    "optimum": { name: "Optimum", bg: "#FF6B00", ink: "#111111", kind: "", letters: "O" },
    "googlefiber": { name: "Google Fiber", bg: "#4285F4", ink: "#111111", kind: "", letters: "GF" },
    "starlink": { name: "Starlink", bg: "#000000", ink: "#ffffff", kind: "", letters: "S" },
    "frontier": { name: "Frontier", bg: "#FF0037", ink: "#111111", kind: "", letters: "F" },
    "centurylink": { name: "CenturyLink", bg: "#00853F", ink: "#ffffff", kind: "", letters: "CL" },
    "dukeenergy": { name: "Duke Energy", bg: "#00A1DE", ink: "#111111", kind: "", letters: "D" },
    "pge": { name: "PG&E", bg: "#0072CE", ink: "#ffffff", kind: "", letters: "PG" },
    "coned": { name: "Con Edison", bg: "#0078CF", ink: "#ffffff", kind: "", letters: "CE" },
    "siriusxm": { name: "SiriusXM", bg: "#0000EB", ink: "#ffffff", kind: "", letters: "SXM" },
    "kindle": { name: "Kindle Unlimited", bg: "#FF9900", ink: "#111111", kind: "", letters: "K" },
    "regal": { name: "Regal", bg: "#C8102E", ink: "#ffffff", kind: "", letters: "R" },
    "adobe": { name: "Adobe", bg: "#FA0F00", ink: "#111111", kind: "", letters: "A" },
    "canva": { name: "Canva", bg: "#00C4CC", ink: "#111111", kind: "", letters: "C" },
    "googleworkspace": { name: "Google Workspace", bg: "#4285F4", ink: "#111111", kind: "", letters: "GW" },
    "slingtv": { name: "Sling TV", bg: "#0F9AE0", ink: "#111111", kind: "", letters: "S" },
    "directv": { name: "DirecTV", bg: "#00A6D6", ink: "#111111", kind: "", letters: "D" },
    "philo": { name: "Philo", bg: "#1E2B4C", ink: "#ffffff", kind: "", letters: "P" },
    "planetfitness": { name: "Planet Fitness", bg: "#5E1F8C", ink: "#ffffff", kind: "", letters: "PF" },
    "calm": { name: "Calm", bg: "#3675CB", ink: "#ffffff", kind: "", letters: "C" },
    "chewy": { name: "Chewy", bg: "#1C49C2", ink: "#ffffff", kind: "", letters: "C" },
    "grubhub": { name: "Grubhub", bg: "#F63440", ink: "#111111", kind: "", letters: "G" },
    "linkedin": { name: "LinkedIn", bg: "#0A66C2", ink: "#ffffff", kind: "", letters: "Li" },
    "slack": { name: "Slack", bg: "#4A154B", ink: "#ffffff", kind: "", letters: "S" },
    "lowes": { name: "Lowe's", bg: "#004990", ink: "#ffffff", kind: "", letters: "L" },
    "thehomedepot": { name: "The Home Depot", bg: "#F96302", ink: "#111111", kind: "", letters: "HD" },
    "bestbuy": { name: "Best Buy", bg: "#0046BE", ink: "#ffffff", kind: "", letters: "BB" },
    "kroger": { name: "Kroger", bg: "#1B3E93", ink: "#ffffff", kind: "", letters: "K" },
    "walgreens": { name: "Walgreens", bg: "#E31837", ink: "#ffffff", kind: "", letters: "W" },
    "cvs": { name: "CVS", bg: "#CC0000", ink: "#ffffff", kind: "", letters: "CVS" },
    "chipotle": { name: "Chipotle", bg: "#451400", ink: "#ffffff", kind: "", letters: "C" },
    "chevron": { name: "Chevron", bg: "#0054A4", ink: "#ffffff", kind: "", letters: "C" },
    "exxon": { name: "Exxon", bg: "#E81A2C", ink: "#ffffff", kind: "", letters: "E" },
    "bp": { name: "BP", bg: "#009900", ink: "#111111", kind: "", letters: "BP" },
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
    "aws": { name: "Amazon Web Services", bg: "#232F3E", ink: "#ffffff", kind: "", letters: "AWS" },
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
  var own = {};
  var setOwnLogos = (logos) => {
    own = logos || {};
  };
  var ownKey = (brand, name) => brand && brand !== "none" ? brand : "name:" + words(name || "").trim();
  function Mark2({ brand, kind, name, type, size, img }) {
    const b2 = brand ? brands[brand] : void 0;
    const cls = "fmark" + (size ? " " + size : "");
    const mine = img ?? own[ownKey(brand, name)];
    if (mine) return /* @__PURE__ */ u3("span", { class: cls + " logo art own", "aria-hidden": "true", children: /* @__PURE__ */ u3("img", { src: mine, alt: "" }) });
    if (b2?.art) return /* @__PURE__ */ u3("span", { class: cls + " logo art", "aria-hidden": "true", children: /* @__PURE__ */ u3("img", { src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(b2.art), alt: "" }) });
    if (b2?.letters) return /* @__PURE__ */ u3("span", { class: cls + " logo mono" + (b2.letters.length > 2 ? " three" : b2.letters.length > 1 ? " two" : ""), style: { background: b2.bg, color: b2.ink }, "aria-hidden": "true", children: b2.letters });
    if (b2) {
      return /* @__PURE__ */ u3("span", { class: cls + " logo", style: { background: b2.bg, color: b2.ink }, "aria-hidden": "true", children: /* @__PURE__ */ u3("svg", { viewBox: "0 0 24 24", children: /* @__PURE__ */ u3("path", { d: b2.path, fill: "currentColor" }) }) });
    }
    const glyph = (type && type !== "other" && kindIcons[type] ? type : "") || hintOf(kind, name) || kind;
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
    "a list": "amc",
    "plex pass": "plex",
    "mullvad": "mullvad",
    "aws": "aws",
    "digital ocean": "digitalocean",
    "nitro": "discord",
    "docker hub": "docker"
  };
  var named;
  var brandWords = () => named ??= [
    ...Object.keys(brands).map((k3) => [words(brands[k3].name), k3]),
    ...Object.entries(aliases).map(([a3, k3]) => [words(a3), k3])
  ].filter(([, k3]) => brands[k3]).sort((a3, b2) => b2[0].length - a3[0].length);
  var loose = /* @__PURE__ */ new Set([
    "box",
    "hey",
    "public",
    "calm",
    "square",
    "medium",
    "delta",
    "shell",
    "ea",
    "zoom",
    "steam",
    "notion",
    "regal",
    "frontier",
    "travelers",
    "nationwide",
    "gemini",
    "kraken",
    "regions",
    "optimum",
    "marcus",
    "empower",
    "acorns",
    "affirm",
    "philo",
    "cox",
    "bp",
    "wix",
    "starz",
    "ring",
    "max"
  ]);
  var tails = /* @__PURE__ */ new Set(["subscription", "membership", "plan", "plus", "premium", "pro", "insurance", "bank", "bill", "account", "card", "monthly", "yearly", "annual", "one", "credit", "checking", "savings", "protect"]);
  var alone = (w3, n2) => w3.startsWith(n2) && w3.slice(n2.length).trim().split(" ").filter(Boolean).every((t3) => tails.has(t3));
  var models = Object.fromEntries(Object.entries({
    mazda: "mazda3|mazda 3|mazda6|cx 3|cx 30|cx 5|cx 50|cx 70|cx 9|cx 90|mx 5|miata",
    ford: "f 150|f150|f 250|mustang|explorer|escape|bronco|ranger|maverick|edge|expedition|mach e",
    toyota: "rav4|rav 4|camry|corolla|tacoma|tundra|highlander|prius|4runner|sienna|sequoia|venza|crown",
    honda: "civic|accord|cr v|crv|hr v|pilot|odyssey|passport|ridgeline",
    tesla: "model 3|model y|model s|model x|cybertruck",
    subaru: "outback|forester|crosstrek|impreza|ascent|wrx|legacy",
    hyundai: "elantra|sonata|tucson|santa fe|palisade|kona|ioniq 5|ioniq 6",
    kia: "telluride|sorento|sportage|soul|forte|ev6|ev9|carnival|niro",
    nissan: "altima|rogue|sentra|pathfinder|leaf|frontier|murano|kicks|versa",
    chevrolet: "silverado|equinox|malibu|tahoe|suburban|bolt|corvette|colorado|traverse|blazer|trax|chevy",
    jeep: "wrangler|cherokee|grand cherokee|gladiator|compass|renegade",
    volkswagen: "jetta|golf|tiguan|atlas|passat|id 4|vw",
    volvo: "xc40|xc60|xc90|v60|s60",
    bmw: "3 series|5 series|x1|x3|x5|x7|i4|ix",
    audi: "a3|a4|a6|q3|q5|q7|e tron"
  }).flatMap(([make, list]) => list.split("|").map((m3) => [m3, make])));
  function brandOf(institution, name, kind) {
    if (institution) return institution;
    if (kind === "other" || kind === "collectible") return void 0;
    const w3 = words(name || "");
    const b2 = brandWords().find(([n2, k3]) => w3.includes(n2) && (!loose.has(k3) || alone(w3, n2)))?.[1];
    if (b2 || kind !== "car") return b2;
    const m3 = Object.keys(models).filter((k3) => w3.includes(" " + k3 + " ")).sort((a3, b3) => b3.length - a3.length)[0];
    return m3 && brands[models[m3]] ? models[m3] : void 0;
  }
  function AcctMark({ a: a3, size }) {
    return /* @__PURE__ */ u3(Mark2, { brand: brandOf(a3.institution, a3.name, a3.kind), kind: a3.kind, name: a3.name, size });
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
  var subTypes = [["streaming", "Streaming and music"], ["software", "Software and apps"], ["cloud", "Cloud and homelab"], ["gaming", "Gaming"], ["news", "News and reading"], ["fitness", "Fitness"], ["food", "Food and delivery"], ["phone", "Phone"], ["other", "Other"]];
  var subTypeName = (t3) => subTypes.find(([k3]) => k3 === t3)?.[1] || t3.charAt(0).toUpperCase() + t3.slice(1);
  var brandTypes = Object.fromEntries(Object.entries({
    streaming: "netflix spotify youtube max paramountplus disneyplus hulu peacock amazonprimevideo appletv applemusic crunchyroll fubotv tidal pandora deezer amazonmusic audible plex twitch amc",
    software: "microsoft365 1password bitwarden chatgpt claude duolingo ynab github docker proton",
    cloud: "icloud googleone dropbox backblaze tailscale cloudflare hetzner digitalocean aws namecheap porkbun mullvad nordvpn synology ring",
    gaming: "xboxgamepass playstation nintendoswitch discord",
    news: "thenewyorktimes patreon",
    fitness: "peloton strava",
    food: "doordash uber",
    phone: "verizon tmobile atandt visiblebyverizon mintmobile googlefi usmobile boostmobile"
  }).flatMap(([type, list]) => list.split(" ").map((b2) => [b2, type])));
  function suggestType(institution, name) {
    const b2 = brandOf(institution, name);
    if (b2 && brandTypes[b2]) return brandTypes[b2];
    const h3 = hintOf("subscriptions", name);
    return h3 === "music" ? "streaming" : h3 && subTypes.some(([k3]) => k3 === h3) ? h3 : "";
  }
  var typeOf = (x2) => x2.type || suggestType(x2.institution, x2.name) || "other";
  function PayMark({ x: x2, size }) {
    return /* @__PURE__ */ u3(Mark2, { brand: brandOf(x2?.institution, x2?.name), kind: x2?.kind, name: x2?.name || "?", type: x2?.kind === "subscriptions" ? x2?.type : void 0, size });
  }
  var brandKinds = Object.fromEntries(Object.entries({
    utilities: "spectrum xfinity cox optimum googlefiber starlink frontier centurylink dukeenergy pge coned",
    spending: "costco walmart target amazon kohls kroger walgreens cvs lowes thehomedepot bestbuy macys etsy ebay starbucks mcdonalds chipotle shell chevron exxon bp instacart",
    car: "geico progressive",
    home: "rocketmortgage mrcooper zillow",
    loans: "nelnet mohela sofi"
  }).flatMap(([kind, list]) => list.split(" ").map((b2) => [b2, kind])));
  function kindForBrand(brand) {
    if (!brand || !brands[brand]) return void 0;
    if (brandKinds[brand]) return brandKinds[brand];
    const k3 = brands[brand].kind;
    if (k3 === "car" || k3 === "home") return k3;
    if (k3 === "card") return "cards";
    const t3 = brandTypes[brand];
    return t3 === "phone" ? "utilities" : t3 ? "subscriptions" : void 0;
  }

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
    const weekday2 = dayText(d3, { weekday: "long" });
    switch (s3.every) {
      case "once":
        return "Once, " + dayShort(s3.start);
      case "week":
        return "Every " + weekday2;
      case "2 weeks":
        return "Every other " + weekday2;
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
  function perMonth(s3, people, checking) {
    if (s3?.every === "paycheck" && !s3.person) return (people || []).filter((e3) => !e3.account || e3.account === checking).reduce((t3, e3) => t3 + perMonth(e3.schedule), 0);
    if (s3?.every === "paycheck") return perMonth((people || []).find((e3) => e3.id === s3.person)?.schedule);
    return { week: 52 / 12, "2 weeks": 26 / 12, "twice a month": 2, month: 1, "3 months": 1 / 3, year: 1 / 12 }[s3?.every] || 0;
  }
  function lookup(p3) {
    const by = (list) => Object.fromEntries((list || []).map((x2) => [x2.id, x2]));
    return { person: by(p3.people), order: Object.fromEntries((p3.people || []).map((e3, i3) => [e3.id, i3 % 4])), account: by(p3.accounts), payment: by(allPayments(p3)) };
  }
  var cardOf = (paymentId) => paymentId?.startsWith("card:") ? paymentId.slice(5) : "";
  function allPayments(p3) {
    const cards = (p3.accounts || []).filter((a3) => a3.kind === "card" && a3.paidEach).map((a3) => ({ id: "card:" + a3.id, name: a3.name, amount: a3.spend || 0, kind: "cards", institution: a3.institution, card: a3.id, schedule: { every: "paycheck", start: "" } }));
    return [...p3.payments || [], ...cards];
  }
  var saving = (kind) => kind === "savings" || kind === "investment" || kind === "retirement";
  var owed = (kind) => kind === "card" || kind === "loan";

  // web/src/finances/importData.ts
  function csvRows(text2) {
    const first = text2.split(/\r?\n/, 1)[0] || "";
    const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : first.includes("	") && !first.includes(",") ? "	" : ",";
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i3 = 0; i3 < text2.length; i3++) {
      const c3 = text2[i3];
      if (quoted) {
        if (c3 === '"' && text2[i3 + 1] === '"') {
          cell += '"';
          i3++;
        } else if (c3 === '"') quoted = false;
        else cell += c3;
      } else if (c3 === '"') quoted = true;
      else if (c3 === sep) {
        row.push(cell);
        cell = "";
      } else if (c3 === "\n" || c3 === "\r") {
        if (c3 === "\r" && text2[i3 + 1] === "\n") i3++;
        row.push(cell);
        cell = "";
        if (row.some((x2) => x2.trim())) rows.push(row);
        row = [];
      } else cell += c3;
    }
    row.push(cell);
    if (row.some((x2) => x2.trim())) rows.push(row);
    return rows.map((r3) => r3.map((x2) => x2.trim()));
  }
  function guessColumns(header) {
    const find = (...words2) => header.findIndex((h3) => words2.some((w3) => h3.toLowerCase().includes(w3)));
    return {
      date: find("date", "posted", "day", "datum"),
      amount: find("amount", "value", "betrag"),
      debit: find("debit", "withdrawal", "money out", "paid out"),
      credit: find("credit", "deposit", "money in", "paid in"),
      payee: find("payee", "description", "name", "merchant", "details", "empfänger", "beschreibung"),
      memo: find("memo", "note", "reference", "category")
    };
  }
  function readDay(s3, dayFirst = false) {
    s3 = s3.trim();
    let m3 = s3.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m3) return ymd(+m3[1], +m3[2], +m3[3]);
    m3 = s3.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})/);
    if (m3) {
      const year = m3[4].length === 2 ? 2e3 + +m3[4] : +m3[4];
      const [mo, d3] = m3[2] === "." || dayFirst ? [+m3[3], +m3[1]] : [+m3[1], +m3[3]];
      return ymd(year, mo, d3);
    }
    const t3 = Date.parse(s3);
    return isNaN(t3) ? "" : isoDay(new Date(t3));
  }
  var ymd = (y3, m3, d3) => m3 >= 1 && m3 <= 12 && d3 >= 1 && d3 <= 31 ? `${y3}-${String(m3).padStart(2, "0")}-${String(d3).padStart(2, "0")}` : "";
  function daysFirst(cells) {
    return cells.some((c3) => /^\d{1,2}\./.test(c3) || /^(\d{1,2})\//.exec(c3) && +/^(\d{1,2})\//.exec(c3)[1] > 12);
  }
  function fromCsv(rows, col) {
    const body = rows.slice(1);
    const dayFirst = daysFirst(body.map((r3) => r3[col.date] || ""));
    const money3 = (s3) => {
      const n2 = parseAmount((s3 || "").replace(/[()]/g, (p3) => p3 === "(" ? "-" : ""));
      return isNaN(n2) ? 0 : n2;
    };
    const out = [];
    for (const r3 of body) {
      const date = readDay(r3[col.date] || "", dayFirst);
      const amount = col.amount >= 0 ? money3(r3[col.amount]) : money3(r3[col.credit]) - Math.abs(money3(r3[col.debit]));
      if (!date || !amount) continue;
      out.push({ date, amount: Math.round(amount * 100) / 100, payee: (r3[col.payee] || "").replace(/\s+/g, " ").trim(), memo: col.memo >= 0 ? r3[col.memo] || void 0 : void 0 });
    }
    return out;
  }
  function fromOfx(text2) {
    const out = [];
    for (const block of text2.split(/<STMTTRN>/i).slice(1)) {
      const tag = (name) => block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"))?.[1].trim() || "";
      const d3 = tag("DTPOSTED");
      const amount = parseFloat(tag("TRNAMT"));
      if (!/^\d{8}/.test(d3) || isNaN(amount)) continue;
      out.push({ date: `${d3.slice(0, 4)}-${d3.slice(4, 6)}-${d3.slice(6, 8)}`, amount: Math.round(amount * 100) / 100, payee: (tag("NAME") || tag("MEMO")).replace(/\s+/g, " "), memo: tag("NAME") && tag("MEMO") ? tag("MEMO") : void 0, id: tag("FITID") || void 0 });
    }
    return out;
  }
  var isOfx = (text2) => /<OFX>|OFXHEADER/i.test(text2.slice(0, 2e3));
  function already(t3, account, ledger) {
    return ledger.some((q2) => q2.account === account && t3.id && q2.bank === t3.id || (q2.account === account || q2.to === account) && q2.date === t3.date && Math.abs((q2.to === account ? -q2.amount : q2.amount) - t3.amount) < 5e-3 && (!q2.payee || !t3.payee || alike(q2.payee, t3.payee)));
  }
  var named2 = (s3) => s3.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w3) => w3.length >= 3 && !["the", "and", "inc", "llc", "payment", "purchase", "card", "debit", "pos"].includes(w3));
  function alike(a3, b2) {
    const x2 = named2(a3), y3 = new Set(named2(b2));
    return a3.toLowerCase() === b2.toLowerCase() || x2.some((w3) => y3.has(w3));
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
    edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
    prev: "M15 18l-6-6 6-6",
    next: "M9 18l6-6-6-6"
  };
  function IconButton({ icon, label, onClick, pressed, disabled }) {
    return /* @__PURE__ */ u3("button", { type: "button", class: "fx-icon", "aria-label": label, title: label, "aria-pressed": pressed, disabled, onClick, children: /* @__PURE__ */ u3("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ u3("path", { d: icons3[icon] }) }) });
  }

  // web/src/finances/widgets/Budgets.tsx
  var budgetTone = (b2) => b2.left < 0 ? "out" : b2.spent > b2.pace + 5e-3 ? "warn" : "";
  var toWatch = (b2) => budgetTone(b2) !== "" || b2.spent >= b2.amount * 0.9;
  function BudgetsWidget({ v: v3, edit, only, open: open2, title = "Budgets", span = "all" }) {
    const list = (v3.budgets || []).filter(only || (() => true));
    if (only && !list.length) return null;
    return /* @__PURE__ */ u3(
      Widget,
      {
        title,
        span,
        kind: "fx-budgets",
        actions: /* @__PURE__ */ u3(S, { children: [
          open2 && /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: open2, children: "See all" }),
          edit && /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: edit, children: v3.budgets?.length ? "Edit budgets" : "Set budgets" })
        ] }),
        children: list.length ? /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: list.map((b2) => {
          const tone = budgetTone(b2);
          const share2 = b2.amount > 0 ? Math.min(100, b2.spent / b2.amount * 100) : 100;
          const pace = b2.amount > 0 ? Math.min(100, b2.pace / b2.amount * 100) : 0;
          const icon = iconOf(v3.categories, b2.category);
          return /* @__PURE__ */ u3(
            Row,
            {
              lead: /* @__PURE__ */ u3(Mark2, { kind: icon, type: icon, name: b2.category }),
              title: b2.category,
              sub: `${b2.per === "paycheck" ? `This pay period, to ${dayShort(b2.last)}` : `This month, to ${dayShort(b2.last)}`} · ${money(b2.spent)} of ${money(b2.amount)}${b2.rolled ? ` (${b2.rolled > 0 ? "with" : "less"} ${money(Math.abs(b2.rolled))} from last time)` : ""}`,
              when: /* @__PURE__ */ u3("span", { class: "fx-budgetleft" + (tone ? " fx-" + tone : ""), children: b2.left < 0 ? /* @__PURE__ */ u3(S, { children: [
                money(-b2.left),
                " over"
              ] }) : /* @__PURE__ */ u3(S, { children: [
                /* @__PURE__ */ u3(Amount, { value: b2.left, form: "full" }),
                " left"
              ] }) }),
              whenPlain: true,
              children: /* @__PURE__ */ u3("span", { class: "fx-budgetbar" + (tone ? " " + tone : ""), role: "img", "aria-label": `${b2.category}: ${money(b2.spent)} spent of ${money(b2.amount)}${tone === "warn" ? ", ahead of an even pace" : ""}`, children: [
                /* @__PURE__ */ u3("span", { style: { width: `${share2}%` } }),
                /* @__PURE__ */ u3("i", { style: { left: `${pace}%` } })
              ] })
            },
            b2.category
          );
        }) }) : /* @__PURE__ */ u3(Empty, { children: edit ? "No budgets yet: set how much a category may take a month or a paycheck, and see what is left as you go." : "No budgets yet." })
      }
    );
  }

  // web/src/finances/Transactions.tsx
  function iconOf(categories2, name) {
    const c3 = (categories2 || []).find((q2) => q2.name.toLowerCase() === (name || "").toLowerCase());
    return c3?.icon || (c3?.parent ? iconOf(categories2, c3.parent) : void 0);
  }
  function TxMark({ t: t3, size, categories: categories2 }) {
    const brand = t3.to ? void 0 : brandOf(t3.institution, t3.payee);
    const icon = t3.to ? "savings" : iconOf(categories2, t3.splits?.length ? t3.splits[0].category : t3.category);
    return /* @__PURE__ */ u3(Mark2, { brand, kind: brand ? void 0 : icon, name: t3.payee || "?", type: brand ? void 0 : icon, size });
  }
  var txTitle = (t3, L2) => t3.payee || (t3.to ? `To ${L2.account[t3.to]?.name || "another account"}` : "No payee");
  var catsOf = (t3) => t3.splits?.length ? t3.splits.map((s3) => s3.category) : t3.category ? [t3.category] : [];
  var wordsOf = (t3, L2) => [t3.payee, ...catsOf(t3), t3.note, ...t3.tags || [], L2.account[t3.account]?.name, t3.to && L2.account[t3.to]?.name].filter(Boolean).join(" ").toLowerCase();
  function Transactions({ v: v3, L: L2, ledger, edit }) {
    const [q2, setQ] = d2("");
    const [account, setAccount] = d2("");
    const [category, setCategory] = d2("");
    const [month3, setMonthPick] = d2("");
    const [way, setWay] = d2("");
    if (!ledger) return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3(Empty, { children: "Reading…" }) });
    const all = ledger.transactions;
    const cats = [...new Set(all.flatMap(catsOf))].sort();
    const months = [...new Set(all.map((t3) => t3.date.slice(0, 7)))].sort().reverse();
    const want = q2.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const shown5 = all.filter((t3) => (!account || t3.account === account || t3.to === account) && (!category || catsOf(t3).includes(category)) && (!month3 || t3.date.startsWith(month3)) && (!way || (way === "move" ? !!t3.to : !t3.to && (way === "in" ? t3.amount > 0 : t3.amount < 0))) && want.every((w3) => wordsOf(t3, L2).includes(w3)));
    const filtered = shown5.length !== all.length;
    const list = [...shown5].reverse();
    const now = v3.today.slice(0, 7);
    const thisMonth = all.filter((t3) => t3.date.startsWith(now) && !t3.to);
    const sum = (f4) => thisMonth.filter(f4).reduce((s3, t3) => s3 + t3.amount, 0);
    const days = [];
    for (const t3 of list) {
      if (days.at(-1)?.date !== t3.date) days.push({ date: t3.date, list: [] });
      days.at(-1).list.push(t3);
    }
    return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3("div", { class: "fx-board", children: [
      /* @__PURE__ */ u3(Widget, { title: "This month", span: "all", kind: "fx-txsum", children: /* @__PURE__ */ u3("div", { class: "fx-stats", children: [
        /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: sum((t3) => t3.amount > 0), form: "whole", tone: "in" }), caption: "Money in" }),
        /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: -sum((t3) => t3.amount < 0), form: "whole", tone: "out" }), caption: "Money out" }),
        /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: sum(() => true), form: "whole", sign: true, tone: "auto" }), caption: plural2(thisMonth.length, "transaction") })
      ] }) }),
      /* @__PURE__ */ u3(BudgetsWidget, { v: v3, edit: edit ? () => edit("budgets") : void 0 }),
      /* @__PURE__ */ u3(
        Widget,
        {
          title: filtered ? `${plural2(shown5.length, "transaction")} of ${all.length}` : "Transactions",
          span: "all",
          kind: "fx-transactions",
          actions: edit && /* @__PURE__ */ u3(S, { children: [
            /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: () => edit("import"), children: "Import a file" }),
            /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: () => edit("categories"), children: "Categories" })
          ] }),
          children: [
            !!all.length && /* @__PURE__ */ u3("div", { class: "fx-txfilters", role: "search", "aria-label": "Find transactions", children: [
              /* @__PURE__ */ u3("input", { type: "search", class: "fx-txsearch", value: q2, onInput: (e3) => setQ(e3.target.value), placeholder: "Search payee, category, note", "aria-label": "Search transactions" }),
              /* @__PURE__ */ u3("select", { "aria-label": "Account", value: account, onChange: (e3) => setAccount(e3.target.value), children: [
                /* @__PURE__ */ u3("option", { value: "", children: "Every account" }),
                (v3.plan.accounts || []).filter((a3) => all.some((t3) => t3.account === a3.id || t3.to === a3.id)).map((a3) => /* @__PURE__ */ u3("option", { value: a3.id, children: a3.name }, a3.id))
              ] }),
              /* @__PURE__ */ u3("select", { "aria-label": "Category", value: category, onChange: (e3) => setCategory(e3.target.value), children: [
                /* @__PURE__ */ u3("option", { value: "", children: "Every category" }),
                cats.map((c3) => /* @__PURE__ */ u3("option", { value: c3, children: c3 }, c3))
              ] }),
              /* @__PURE__ */ u3("select", { "aria-label": "Month", value: month3, onChange: (e3) => setMonthPick(e3.target.value), children: [
                /* @__PURE__ */ u3("option", { value: "", children: "Every month" }),
                months.map((m3) => /* @__PURE__ */ u3("option", { value: m3, children: [
                  monthName(m3 + "-01"),
                  " ",
                  m3.slice(0, 4)
                ] }, m3))
              ] }),
              /* @__PURE__ */ u3("select", { "aria-label": "In or out", value: way, onChange: (e3) => setWay(e3.target.value), children: [
                /* @__PURE__ */ u3("option", { value: "", children: "In and out" }),
                /* @__PURE__ */ u3("option", { value: "out", children: "Money out" }),
                /* @__PURE__ */ u3("option", { value: "in", children: "Money in" }),
                /* @__PURE__ */ u3("option", { value: "move", children: "Between my accounts" })
              ] }),
              filtered && /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: () => {
                setQ("");
                setAccount("");
                setCategory("");
                setMonthPick("");
                setWay("");
              }, children: "Show all" })
            ] }),
            filtered && !!shown5.length && /* @__PURE__ */ u3("p", { class: "fx-sub fx-txtotal", children: [
              "Together ",
              /* @__PURE__ */ u3(Amount, { value: shown5.filter((t3) => !t3.to || account).reduce((s3, t3) => s3 + (account && t3.to === account ? -t3.amount : t3.amount), 0), form: "full", sign: true })
            ] }),
            days.map((d3) => /* @__PURE__ */ u3("section", { class: "fx-txday", "aria-label": dayLong(d3.date), children: [
              /* @__PURE__ */ u3("h3", { children: [
                dayLong(d3.date),
                d3.date === v3.today ? ", today" : ""
              ] }),
              /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: d3.list.map((t3) => {
                const a3 = L2.account[t3.account];
                const where = t3.to ? `${a3?.name || t3.account} → ${L2.account[t3.to]?.name || t3.to}` : a3?.name || t3.account;
                const what = t3.splits?.length ? t3.splits.map((s3) => s3.category).join(", ") : t3.category || (t3.to ? "Transfer" : "No category");
                return /* @__PURE__ */ u3(
                  Row,
                  {
                    lead: /* @__PURE__ */ u3(TxMark, { t: t3, categories: v3.categories }),
                    title: txTitle(t3, L2),
                    sub: /* @__PURE__ */ u3(S, { children: [
                      what,
                      " · ",
                      where,
                      t3.note && /* @__PURE__ */ u3("span", { class: "fx-txnote", children: [
                        " · ",
                        t3.note
                      ] })
                    ] }),
                    when: /* @__PURE__ */ u3(Amount, { value: t3.amount, sign: t3.amount > 0, tone: t3.amount > 0 && !t3.to ? "in" : "", form: "full" }),
                    whenPlain: true,
                    onOpen: edit ? () => edit("transaction", t3.id) : void 0,
                    openLabel: edit ? "edit" : void 0
                  },
                  t3.id
                );
              }) })
            ] }, d3.date)),
            !all.length && /* @__PURE__ */ u3(Empty, { children: edit ? "No transactions yet: add what you spend with Add a transaction, as it happens or from the receipt." : "No transactions yet." }),
            !!all.length && !shown5.length && /* @__PURE__ */ u3(Empty, { children: "None match: try fewer words, or Show all." })
          ]
        }
      )
    ] }) });
  }

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
  var named3 = (kind, b2) => ({ checking: `${b2} Checking`, savings: `${b2} Savings`, investment: `${b2} brokerage`, retirement: `${b2} retirement`, loan: `${b2} loan` })[kind] || b2;
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
        if (e3.target.closest(".brandgrid button, .kindswap button, .dedrow button, button.addded, .ownlogo button, .catlist button")) setTouched(true);
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
  async function shrink(f4) {
    const bmp = await createImageBitmap(f4);
    const n2 = 96, scale = Math.min(n2 / bmp.width, n2 / bmp.height, 1);
    const w3 = Math.max(1, Math.round(bmp.width * scale)), h3 = Math.max(1, Math.round(bmp.height * scale));
    const c3 = new OffscreenCanvas(n2, n2);
    c3.getContext("2d").drawImage(bmp, (n2 - w3) / 2, (n2 - h3) / 2, w3, h3);
    const url = (b2) => new Promise((ok, bad) => {
      const r3 = new FileReader();
      r3.onload = () => ok(String(r3.result));
      r3.onerror = () => bad(r3.error);
      r3.readAsDataURL(b2);
    });
    const png = await url(await c3.convertToBlob({ type: "image/png" }));
    return png.length < 6e4 ? png : url(await c3.convertToBlob({ type: "image/webp", quality: 0.85 }));
  }
  function OwnLogo({ value, set: set2, what }) {
    const file = A2(null);
    const [problem, setProblem] = d2("");
    const read = async (f4) => {
      if (!f4) return;
      try {
        set2(await shrink(f4));
        setProblem("");
      } catch {
        setProblem("That file is not a picture this can read: try a PNG or a JPEG.");
      }
    };
    return /* @__PURE__ */ u3("div", { class: "ownlogo", children: [
      /* @__PURE__ */ u3("input", { ref: file, type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", hidden: true, "aria-label": `Your own image for ${what}`, onChange: (e3) => {
        read(e3.currentTarget.files?.[0]);
        e3.currentTarget.value = "";
      } }),
      /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: () => file.current?.click(), children: value ? "Use another image" : `Use your own image for ${what}` }),
      value && /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: () => set2(void 0), children: "Remove your image" }),
      problem && /* @__PURE__ */ u3("span", { class: "formerr bad", role: "alert", children: problem })
    ] });
  }
  function withLogo(plan, key2, img, opened2, had) {
    const logos = { ...plan.logos || {} };
    if (img) logos[key2] = img;
    else if (had) delete logos[opened2];
    return Object.keys(logos).length ? logos : void 0;
  }
  var tick2 = (set2) => (e3) => set2(e3.currentTarget.checked);
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
        !!people?.length && /* @__PURE__ */ u3("option", { value: "paycheck:", children: "With each paycheck, whoever is paid" }),
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
    const kindPicked = A2(!!x2);
    const follow2 = (b2) => {
      const k3 = kindForBrand(b2);
      if (k3 && !kindPicked.current) setKind(k3);
    };
    const rename = (n2) => {
      setName(n2);
      if (!picked.current) {
        const b2 = brandOf(void 0, n2) || "";
        setBrand(b2);
        follow2(b2);
      }
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
    const [type, setType] = d2(x2?.type || "");
    const opened2 = ownKey(brandOf(x2?.institution, x2?.name), x2?.name);
    const had = plan.logos?.[opened2];
    const [img, setImg] = d2(had);
    const suggested = suggestType(brand, name);
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
        card: card || void 0,
        type: kind === "subscriptions" && type ? type : void 0
      };
      const list = (plan.payments || []).slice();
      const at = list.findIndex((q2) => q2.id === x2?.id);
      if (at >= 0) list[at] = p3;
      else list.push(p3);
      keep2({ ...plan, payments: list, logos: withLogo(plan, ownKey(brand, p3.name), img, opened2, had) });
    };
    const remove = () => keep2({ ...plan, payments: (plan.payments || []).filter((q2) => q2.id !== x2?.id) });
    return /* @__PURE__ */ u3("form", { class: "finform", onSubmit: submit, ...watch2, children: [
      /* @__PURE__ */ u3("div", { class: "formhead", children: [
        /* @__PURE__ */ u3(Mark2, { brand: brand === "none" ? "" : brand, kind, name: name || "Payment", type: kind === "subscriptions" ? type || suggested : void 0, img, size: "lg" }),
        /* @__PURE__ */ u3("h2", { id: "finSheetTitle", children: x2 ? x2.name : "Add a payment" })
      ] }),
      /* @__PURE__ */ u3(BrandPick, { kind, value: brand === "none" ? "" : brand, set: (k3) => {
        picked.current = true;
        setBrand(k3 || "none");
        follow2(k3);
        if (k3 && !name.trim()) setName(brandName(k3));
      }, payment: true }),
      /* @__PURE__ */ u3(OwnLogo, { value: img, set: setImg, what: brand && brand !== "none" ? brandName(brand) : name.trim() || "this payment" }),
      /* @__PURE__ */ u3("div", { class: "formgrid", children: [
        /* @__PURE__ */ u3(Field, { label: "Name", children: /* @__PURE__ */ u3("input", { value: name, onInput: input(rename), placeholder: "Mortgage", required: true }) }),
        /* @__PURE__ */ u3(MoneyField, { label: card ? "Other spending on it each time (each pays the balance)" : "Amount", value: amount, set: setAmount }),
        /* @__PURE__ */ u3(Field, { label: "Category", children: /* @__PURE__ */ u3("select", { value: kind, onChange: input((k3) => {
          kindPicked.current = true;
          setKind(k3);
        }), children: categories.map(([v3, t3]) => /* @__PURE__ */ u3("option", { value: v3, children: t3 }, v3)) }) }),
        kind === "subscriptions" && /* @__PURE__ */ u3(Field, { label: "Type", children: /* @__PURE__ */ u3("select", { value: type, onChange: input(setType), children: [
          /* @__PURE__ */ u3("option", { value: "", children: suggested ? `${subTypeName(suggested)} (from its ${brand && brand !== "none" ? "logo" : "name"})` : "Other (pick one)" }),
          subTypes.map(([v3, t3]) => /* @__PURE__ */ u3("option", { value: v3, children: t3 }, v3))
        ] }) }),
        /* @__PURE__ */ u3(ScheduleFields, { every, setEvery, start, setStart, day2: day22, setDay2, startLabel: x2 ? "Starting" : "Next on", people: plan.people, person, setPerson }),
        /* @__PURE__ */ u3(AccountSelect, { label: "Comes out of, or is charged to", value: from, set: setFrom, accounts: accounts.filter((a3) => (a3.kind === "card" || !owed(a3.kind)) && !held(a3.kind)), none: accounts.length ? void 0 : "Checking" }),
        /* @__PURE__ */ u3(AccountSelect, { label: "Goes into", value: to, set: setTo, accounts: accounts.filter((a3) => a3.id !== from && !held(a3.kind)), none: "Nowhere (a bill)" }),
        /* @__PURE__ */ u3(AccountSelect, { label: "Pays off a card", value: card, set: setCard, accounts: accounts.filter((a3) => a3.kind === "card"), none: "No" }),
        /* @__PURE__ */ u3("label", { class: "fcheckbox wide", children: [
          /* @__PURE__ */ u3("input", { type: "checkbox", checked: estimate, onClick: tick2(setEstimate) }),
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
        if (!g2 || !on) return;
        const top = on.getBoundingClientRect().top - g2.getBoundingClientRect().top, bottom = top + on.getBoundingClientRect().height;
        if (top < 0 || bottom > g2.clientHeight) g2.scrollTop += top - 4;
      });
      return () => cancelAnimationFrame(id2);
    }, [value]);
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
    const [brand, setBrand] = d2(brandOf(a3?.institution, a3?.name, a3?.kind || props.kind) || "");
    const picked = A2(!!a3?.institution);
    const rename = (n2) => {
      setName(n2);
      if (!picked.current) setBrand(brandOf(void 0, n2, kind) || "");
    };
    const pickBrand = (k3) => {
      picked.current = true;
      setBrand(k3 || "none");
    };
    const opened2 = ownKey(brandOf(a3?.institution, a3?.name, a3?.kind), a3?.name);
    const had = plan.logos?.[opened2];
    const [img, setImg] = d2(had);
    const real = brand === "none" ? "" : brand;
    const [balance, setBalance] = d2(text(a3?.balance));
    const [pending2, setPending2] = d2(text(a3?.pending));
    const [rate, setRate] = d2(text(a3?.rate));
    const [original, setOriginal] = d2(text(a3?.original));
    const [loan, setLoan] = d2(a3?.loan || "");
    const [detail, setDetail] = d2(a3?.detail || "");
    const [paidEach, setPaidEach] = d2(!!a3?.paidEach);
    const [spend, setSpend] = d2(text(a3?.spend));
    const payer = (plan.payments || []).find((x2) => a3 && x2.card === a3.id);
    const { busy, keep: keep2, touched, watch: watch2 } = useSaving(props);
    const [problem, setProblem] = d2("");
    const loans = (plan.accounts || []).filter((q2) => q2.kind === "loan");
    const submit = (e3) => {
      e3.preventDefault();
      const wrong = !name.trim() && !real ? "Give it a name, or pick its bank." : num(balance) < 0 && (owed(kind) || held(kind)) ? "Type it without a minus." : kind === "card" && paidEach && payer ? `“${payer.name}” pays it off already: delete that payment, or leave this off.` : kind === "card" && paidEach && num(spend) < 0 ? "Type the spending without a minus." : "";
      setProblem(wrong);
      if (wrong) return;
      const retyped = !a3 || num(balance) !== a3.balance || kind === "card" && num(pending2) !== (a3.pending || 0);
      const next = {
        id: a3?.id || "",
        kind,
        name: name.trim() || (real ? named3(kind, brandName(real)) : ""),
        institution: brand || void 0,
        balance: num(balance),
        detail: detail.trim() || void 0,
        updated: retyped ? todayISO() : a3?.updated,
        pending: kind === "card" ? num(pending2) : void 0,
        rate: kind === "savings" || kind === "loan" || kind === "card" ? num(rate) || void 0 : void 0,
        original: kind === "loan" ? num(original) : void 0,
        loan: kind === "home" || kind === "car" ? loan || void 0 : void 0,
        paidEach: kind === "card" && paidEach ? true : void 0,
        spend: kind === "card" && paidEach ? num(spend) || void 0 : void 0
      };
      const list = (plan.accounts || []).slice();
      const at = list.findIndex((q2) => q2.id === a3?.id);
      if (at >= 0) list[at] = next;
      else list.push(next);
      keep2({ ...plan, accounts: list, logos: withLogo(plan, ownKey(brand, next.name), img, opened2, had) });
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
      picked.current = false;
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
    const said = name.trim() || (real ? named3(kind, brandName(real)) : "");
    return /* @__PURE__ */ u3("form", { class: "finform", ref: form2, onSubmit: submit, ...watch2, children: [
      /* @__PURE__ */ u3("div", { class: "formhead", children: [
        /* @__PURE__ */ u3(Mark2, { brand: real, kind, name: said || "Account", img, size: "lg" }),
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
      kind !== "other" && kind !== "collectible" && /* @__PURE__ */ u3(BrandPick, { kind, value: real, set: pickBrand }),
      /* @__PURE__ */ u3(OwnLogo, { value: img, set: setImg, what: real ? brandName(real) : said || "this account" }),
      /* @__PURE__ */ u3("div", { class: "formgrid", children: [
        /* @__PURE__ */ u3(Field, { label: "Name", children: /* @__PURE__ */ u3("input", { value: name, onInput: input(rename), placeholder: real ? named3(kind, brandName(brand)) : { checking: "Chase Checking", savings: "Savings", card: "Chase Freedom", investment: "Brokerage", retirement: "401(k)", loan: "Car loan", home: "Home", car: "2022 RAV4", collectible: "Trading cards, jewelry", other: "A boat" }[kind], required: !brand }) }),
        /* @__PURE__ */ u3(MoneyField, { label: owes ? "Owed" : held(kind) ? "Worth" : "Balance", value: balance, set: setBalance }),
        kind === "card" && /* @__PURE__ */ u3(MoneyField, { label: "Pending", value: pending2, set: setPending2 }),
        kind === "card" && /* @__PURE__ */ u3("label", { class: "fcheckbox wide", children: [
          /* @__PURE__ */ u3("input", { type: "checkbox", checked: paidEach, onClick: tick2(setPaidEach) }),
          " I pay it off in full with each paycheck"
        ] }),
        kind === "card" && paidEach && /* @__PURE__ */ u3(MoneyField, { label: "Spending on it between paychecks, about", value: spend, set: setSpend, hint: "400.00" }),
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
  function BalancesForm(props) {
    const { plan, start } = props;
    const accounts = plan.accounts || [];
    const est = (a3) => owed(a3.kind) ? Math.max(0, Math.round(((start?.[a3.id] ?? a3.balance + (a3.pending || 0)) - (a3.pending || 0)) * 100) / 100) : start?.[a3.id] ?? a3.balance;
    const [typed, setTyped] = d2(() => ({ cushion: String(plan.cushion || 0), ...Object.fromEntries(accounts.flatMap((a3) => [[a3.id, String(est(a3))], ...a3.kind === "card" ? [[a3.id + ":p", String(a3.pending || 0)]] : []])) }));
    const { busy, keep: keep2, touched, watch: watch2 } = useSaving(props);
    const [problem, setProblem] = d2("");
    const first = A2(null);
    _2(() => {
      first.current?.focus();
      first.current?.select();
    }, []);
    const read = (key2, was) => {
      const n2 = parseAmount(typed[key2] ?? "");
      return typed[key2]?.trim() && !isNaN(n2) ? n2 : was;
    };
    const submit = (e3) => {
      e3.preventDefault();
      const bad = accounts.find((a3) => (owed(a3.kind) || held(a3.kind)) && read(a3.id, est(a3)) < 0);
      const wrong = bad ? `${bad.name}: type it without a minus.` : "";
      setProblem(wrong);
      if (wrong) return;
      const today = todayISO();
      keep2({ ...plan, updated: today, cushion: Math.max(0, read("cushion", plan.cushion || 0)), accounts: accounts.map((a3) => ({ ...a3, balance: read(a3.id, est(a3)), pending: a3.kind === "card" ? read(a3.id + ":p", a3.pending || 0) : a3.pending, updated: today })) });
    };
    const type = (key2) => (e3) => setTyped({ ...typed, [key2]: e3.target.value });
    return /* @__PURE__ */ u3("form", { class: "finform finbalances", onSubmit: submit, ...watch2, children: [
      /* @__PURE__ */ u3("div", { class: "formhead", children: /* @__PURE__ */ u3("h2", { id: "finSheetTitle", children: "Update balances" }) }),
      /* @__PURE__ */ u3("p", { class: "formsub muted", children: "Each starts at what it should hold today. Type what your bank shows, then press Enter." }),
      /* @__PURE__ */ u3("ul", { class: "balancelist" + (accounts.some((a3) => a3.kind === "card") ? " cards" : ""), children: accounts.map((a3, i3) => {
        const d3 = read(a3.id, est(a3)) - est(a3);
        return /* @__PURE__ */ u3("li", { children: [
          /* @__PURE__ */ u3(AcctMark, { a: a3, size: "sm" }),
          /* @__PURE__ */ u3("label", { class: "grow", for: "bal-" + a3.id, children: [
            /* @__PURE__ */ u3("strong", { children: a3.name }),
            /* @__PURE__ */ u3("small", { children: [
              owed(a3.kind) ? "owed" : held(a3.kind) ? "worth" : "today",
              " · expected ",
              money(est(a3)),
              Math.abs(d3) >= 5e-3 && /* @__PURE__ */ u3(S, { children: [
                ", ",
                /* @__PURE__ */ u3("span", { class: d3 < 0 === !owed(a3.kind) ? "bad" : "ok", children: signedText(d3) })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ u3("span", { class: "moneyfield", children: [
            /* @__PURE__ */ u3("span", { "aria-hidden": "true", children: currencySign() }),
            /* @__PURE__ */ u3("input", { id: "bal-" + a3.id, ref: i3 === 0 ? first : void 0, inputmode: "decimal", value: typed[a3.id], onInput: type(a3.id) })
          ] }),
          a3.kind === "card" && /* @__PURE__ */ u3("label", { class: "pendingfield", children: [
            /* @__PURE__ */ u3("span", { class: "moneyfield", children: [
              /* @__PURE__ */ u3("span", { "aria-hidden": "true", children: currencySign() }),
              /* @__PURE__ */ u3("input", { "aria-label": `${a3.name} pending`, inputmode: "decimal", value: typed[a3.id + ":p"], onInput: type(a3.id + ":p") })
            ] }),
            /* @__PURE__ */ u3("small", { "aria-hidden": "true", children: "pending" })
          ] })
        ] }, a3.id);
      }) }),
      !accounts.length && /* @__PURE__ */ u3("p", { class: "muted", children: "No accounts yet: add one first." }),
      /* @__PURE__ */ u3("label", { class: "field cushion", children: [
        "Flag checking under ",
        /* @__PURE__ */ u3("span", { class: "moneyfield", children: [
          /* @__PURE__ */ u3("span", { "aria-hidden": "true", children: currencySign() }),
          /* @__PURE__ */ u3("input", { inputmode: "decimal", value: typed.cushion, onInput: type("cushion") })
        ] })
      ] }),
      /* @__PURE__ */ u3(Actions3, { busy, exists: false, remove: () => {
      }, close: props.close, problem, touched })
    ] });
  }
  var signedText = (n2) => (n2 < 0 ? "−" : "+") + money(Math.abs(n2));
  function TransactionForm(props) {
    const { plan, checking, ledger } = props;
    const t3 = (ledger?.transactions || []).find((q2) => q2.id === props.id);
    const accounts = (plan.accounts || []).filter((a3) => !held(a3.kind));
    const payments = allPayments(plan);
    const [way, setWay] = d2(t3?.to ? "move" : t3 && t3.amount > 0 ? "in" : "out");
    const [payee, setPayee] = d2(t3?.payee || "");
    const [amount, setAmount] = d2(t3 ? String(Math.abs(t3.amount)) : "");
    const [date, setDate] = d2(t3?.date || todayISO());
    const [account, setAccount] = d2(t3?.account || checking || accounts[0]?.id || "");
    const [to, setTo] = d2(t3?.to || "");
    const [category, setCategory] = d2(t3?.category || "");
    const [payment, setPayment] = d2(t3?.payment || "");
    const [note, setNote] = d2(t3?.note || "");
    const [parts2, setParts] = d2((t3?.splits || []).map((sp) => ({ category: sp.category, amount: text(Math.abs(sp.amount)), note: sp.note || "" })));
    const [tagText, setTagText] = d2((t3?.tags || []).join(", "));
    const setPart = (i3, k3, val) => setParts(parts2.map((sp, j3) => j3 === i3 ? { ...sp, [k3]: val } : sp));
    const placed = parts2.reduce((sum, sp) => sum + num(sp.amount), 0);
    const split2 = () => setParts(parts2.length ? [...parts2, { category: "", amount: "", note: "" }] : [{ category: category.trim(), amount: amount.trim(), note: "" }, { category: "", amount: "", note: "" }]);
    const { busy, touched, watch: watch2 } = useSaving(props);
    const [saving2, setSaving] = d2(false);
    const [problem, setProblem] = d2("");
    const past = (f4) => [...new Set((ledger?.transactions || []).map(f4).filter(Boolean))].sort();
    const named5 = (props.categories || []).map((c3) => c3.name);
    const categoryList = [...named5, ...past((q2) => q2.category).filter((c3) => !named5.some((n2) => n2.toLowerCase() === c3.toLowerCase()))];
    const catTyped = A2(!!t3);
    const lastFor = (who) => [...ledger?.transactions || []].reverse().find((q2) => q2.payee && q2.payee.toLowerCase() === who.trim().toLowerCase() && q2.category)?.category;
    const typePayee = (who) => {
      setPayee(who);
      if (!catTyped.current) setCategory(lastFor(who) || "");
    };
    const choose = (id2) => {
      setPayment(id2);
      const x2 = payments.find((q2) => q2.id === id2);
      if (!x2) return;
      if (!payee.trim()) setPayee(x2.name);
      if (!amount.trim() && x2.amount) setAmount(String(x2.amount));
      if (!category.trim()) setCategory(categories.find(([k3]) => k3 === x2.kind)?.[1] || "");
      if (x2.card && way !== "move") setWay("out");
    };
    const keepLedger = async (list) => {
      setSaving(true);
      const ok = await props.saveLedger({ ...ledger || { transactions: [] }, transactions: list });
      setSaving(false);
      if (ok) props.close();
    };
    const submit = (e3) => {
      e3.preventDefault();
      const n2 = num(amount);
      const used = way === "move" ? [] : parts2.filter((sp) => sp.category.trim() || num(sp.amount));
      const wrong = !(n2 > 0) ? "Type how much it was." : way === "move" && !to ? "Pick the account it went into." : way === "move" && to === account ? "It went into another account: pick that one." : way !== "move" && !payee.trim() ? "Who was paid, or who paid?" : !date ? "Pick the day." : used.some((sp) => !sp.category.trim()) ? "Give each part a category." : used.length && Math.abs(used.reduce((sum, sp) => sum + num(sp.amount), 0) - n2) >= 5e-3 ? `The parts come to ${money(used.reduce((sum, sp) => sum + num(sp.amount), 0))}, not ${money(n2)}.` : "";
      setProblem(wrong);
      if (wrong) return;
      const next = {
        ...t3 || {},
        id: t3?.id || "",
        date,
        account,
        amount: way === "in" ? n2 : -n2,
        payee: payee.trim() || void 0,
        category: category.trim() || void 0,
        note: note.trim() || void 0,
        payment: payment || void 0,
        to: way === "move" ? to : void 0,
        institution: t3?.institution,
        splits: used.length > 1 ? used.map((sp) => ({ category: sp.category.trim(), amount: way === "in" ? num(sp.amount) : -num(sp.amount), note: sp.note.trim() || void 0 })) : void 0,
        tags: tagText.split(",").map((x2) => x2.trim().toLowerCase()).filter((x2, i3, all) => x2 && all.indexOf(x2) === i3)
      };
      if (used.length === 1) next.category = used[0].category.trim();
      if (used.length > 1) next.category = void 0;
      if (!next.tags.length) next.tags = void 0;
      const list = (ledger?.transactions || []).slice();
      const at = list.findIndex((q2) => q2.id === t3?.id);
      if (at >= 0) list[at] = next;
      else list.push(next);
      keepLedger(list);
    };
    const remove = () => keepLedger((ledger?.transactions || []).filter((q2) => q2.id !== t3?.id));
    return /* @__PURE__ */ u3("form", { class: "finform", onSubmit: submit, ...watch2, children: [
      /* @__PURE__ */ u3("div", { class: "formhead", children: [
        /* @__PURE__ */ u3(TxMark, { t: { id: "", date, account, amount: 0, payee, institution: t3?.institution, category, to: way === "move" ? to || "x" : void 0 }, categories: props.categories, size: "lg" }),
        /* @__PURE__ */ u3("h2", { id: "finSheetTitle", children: t3 ? t3.payee || "Transfer" : "Add a transaction" })
      ] }),
      /* @__PURE__ */ u3("div", { class: "kindswap", children: /* @__PURE__ */ u3(Segmented, { label: "What it was", value: way, pick: setWay, options: [["out", "Money out"], ["in", "Money in"], ["move", "Between my accounts"]] }) }),
      /* @__PURE__ */ u3("div", { class: "formgrid", children: [
        /* @__PURE__ */ u3(Field, { label: way === "in" ? "From" : way === "move" ? "What for (optional)" : "Paid to", children: /* @__PURE__ */ u3("input", { value: payee, onInput: input(typePayee), list: "finPayees", placeholder: way === "in" ? "Alex's paycheck" : way === "move" ? "Emergency fund" : "Costco" }) }),
        /* @__PURE__ */ u3(MoneyField, { label: "Amount", value: amount, set: setAmount }),
        /* @__PURE__ */ u3(Field, { label: "Day", children: /* @__PURE__ */ u3("input", { type: "date", value: date, onInput: input(setDate), required: true }) }),
        /* @__PURE__ */ u3(AccountSelect, { label: way === "in" ? "Into" : way === "move" ? "Out of" : "Out of, or charged to", value: account, set: setAccount, accounts }),
        way === "move" && /* @__PURE__ */ u3(AccountSelect, { label: "Into", value: to, set: setTo, accounts: accounts.filter((a3) => a3.id !== account), none: "Pick one" }),
        way !== "move" && !parts2.length && /* @__PURE__ */ u3(Field, { label: "Category", children: /* @__PURE__ */ u3("input", { value: category, onInput: input((c3) => {
          catTyped.current = true;
          setCategory(c3);
        }), list: "finCategories", placeholder: "Groceries" }) }),
        /* @__PURE__ */ u3(Field, { label: "Pays a planned payment", children: /* @__PURE__ */ u3("select", { value: payment, onChange: input(choose), children: [
          /* @__PURE__ */ u3("option", { value: "", children: "None" }),
          payments.map((x2) => /* @__PURE__ */ u3("option", { value: x2.id, children: x2.name }, x2.id))
        ] }) }),
        /* @__PURE__ */ u3(Field, { label: "Note", wide: true, children: /* @__PURE__ */ u3("input", { value: note, onInput: input(setNote) }) }),
        /* @__PURE__ */ u3(Field, { label: "Tags (a comma between)", wide: true, children: /* @__PURE__ */ u3("input", { value: tagText, onInput: input(setTagText), placeholder: "vacation, tax-deductible" }) })
      ] }),
      way !== "move" && /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("h3", { class: "formsub", children: [
          "Split across categories ",
          /* @__PURE__ */ u3("span", { class: "muted", children: parts2.length ? Math.abs(placed - num(amount)) < 5e-3 ? "all of it placed" : `${money(num(amount) - placed)} left to place` : "" })
        ] }),
        parts2.map((sp, i3) => /* @__PURE__ */ u3("div", { class: "dedrow", children: [
          /* @__PURE__ */ u3("input", { "aria-label": `Part ${i3 + 1} category`, value: sp.category, placeholder: "Groceries", list: "finCategories", onInput: (ev) => setPart(i3, "category", ev.target.value) }),
          /* @__PURE__ */ u3("span", { class: "moneyfield", children: [
            /* @__PURE__ */ u3("span", { "aria-hidden": "true", children: currencySign() }),
            /* @__PURE__ */ u3("input", { "aria-label": `Part ${i3 + 1} amount`, inputmode: "decimal", value: sp.amount, onInput: (ev) => setPart(i3, "amount", ev.target.value) })
          ] }),
          /* @__PURE__ */ u3("input", { "aria-label": `Part ${i3 + 1} note`, value: sp.note, placeholder: "Note", onInput: (ev) => setPart(i3, "note", ev.target.value) }),
          /* @__PURE__ */ u3("button", { type: "button", class: "small", "aria-label": `Remove part ${i3 + 1}`, onClick: () => setParts(parts2.filter((_3, j3) => j3 !== i3)), children: "Remove" })
        ] }, i3)),
        /* @__PURE__ */ u3("p", { children: /* @__PURE__ */ u3("button", { type: "button", class: "small addded", onClick: split2, children: parts2.length ? "Add a part" : "Split it" }) })
      ] }),
      /* @__PURE__ */ u3("datalist", { id: "finPayees", children: past((q2) => q2.payee).map((x2) => /* @__PURE__ */ u3("option", { value: x2 }, x2)) }),
      /* @__PURE__ */ u3("datalist", { id: "finCategories", children: categoryList.map((x2) => /* @__PURE__ */ u3("option", { value: x2 }, x2)) }),
      /* @__PURE__ */ u3(Actions3, { busy: busy || saving2, exists: !!t3, remove, close: props.close, problem, touched })
    ] });
  }
  var categoryIcons = [
    ["", "None"],
    ["home", "Home"],
    ["utilities", "Power"],
    ["water", "Water"],
    ["internet", "Internet"],
    ["phone", "Phone"],
    ["heat", "Gas or heat"],
    ["food", "Food"],
    ["spending", "Shopping cart"],
    ["car", "Car"],
    ["insurance", "Insurance"],
    ["subscriptions", "Repeat"],
    ["streaming", "TV"],
    ["music", "Music"],
    ["software", "Software"],
    ["cloud", "Cloud"],
    ["gaming", "Games"],
    ["news", "News"],
    ["fitness", "Fitness"],
    ["health", "Health"],
    ["school", "School"],
    ["savings", "Money in"],
    ["trash", "Trash"],
    ["other", "Box"]
  ];
  function CategoriesForm(props) {
    const { plan, ledger } = props;
    const [rows, setRows] = d2(() => (props.categories || []).map((c3) => ({ was: c3.name, name: c3.name, parent: c3.parent || "", icon: c3.icon || "", income: !!c3.income })));
    const [busy, setBusy] = d2(false);
    const [touched, setTouched] = d2(false);
    const [problem, setProblem] = d2("");
    const set2 = (i3, k3, val) => {
      setTouched(true);
      setRows(rows.map((r3, j3) => j3 === i3 ? { ...r3, [k3]: val } : r3));
    };
    const groups3 = rows.filter((r3) => !r3.parent && r3.name.trim());
    const ordered = groups3.flatMap((g2) => [g2, ...rows.filter((r3) => r3.parent === g2.name)]).concat(rows.filter((r3) => r3.parent && !groups3.some((g2) => g2.name === r3.parent) || !r3.parent && !r3.name.trim()));
    const submit = async (e3) => {
      e3.preventDefault();
      const names2 = rows.map((r3) => r3.name.trim().toLowerCase());
      const twice = names2.find((n2, i3) => n2 && names2.indexOf(n2) !== i3);
      const wrong = names2.some((n2) => !n2) ? "Give each category a name, or delete it." : twice ? `Two categories are called “${rows.find((r3) => r3.name.trim().toLowerCase() === twice).name.trim()}”.` : "";
      setProblem(wrong);
      if (wrong) return;
      const renamed = new Map(rows.filter((r3) => r3.was).map((r3) => [r3.was, r3.name.trim()]));
      const now = (old) => {
        if (!old) return old;
        if (renamed.has(old)) return renamed.get(old);
        const gone = (props.categories || []).find((c3) => c3.name === old);
        if (!gone) return old;
        return gone.parent ? now(gone.parent) : void 0;
      };
      const categories2 = rows.map((r3) => ({ name: r3.name.trim(), parent: r3.parent && renamed.get(r3.parent) || r3.parent || void 0, icon: r3.icon || void 0, income: r3.income || void 0 }));
      let changed2 = false;
      const transactions = (ledger?.transactions || []).map((t3) => {
        const cat = now(t3.category), splits = t3.splits?.map((sp) => ({ ...sp, category: now(sp.category) || "Other" }));
        if (cat === t3.category && JSON.stringify(splits) === JSON.stringify(t3.splits)) return t3;
        changed2 = true;
        return { ...t3, category: cat, splits };
      });
      setBusy(true);
      let ok = await props.save({ ...plan, categories: categories2 });
      if (ok && changed2 && props.saveLedger) ok = await props.saveLedger({ ...ledger || { transactions: [] }, transactions });
      setBusy(false);
      if (ok) props.close();
    };
    const add = () => {
      setTouched(true);
      setRows([...rows, { was: "", name: "", parent: "", icon: "", income: false }]);
    };
    return /* @__PURE__ */ u3("form", { class: "finform fincats", onSubmit: submit, children: [
      /* @__PURE__ */ u3("div", { class: "formhead", children: /* @__PURE__ */ u3("h2", { id: "finSheetTitle", children: "Categories" }) }),
      /* @__PURE__ */ u3("p", { class: "formsub muted", children: "Renaming one renames it on every transaction; deleting one moves its transactions to its group." }),
      /* @__PURE__ */ u3("ul", { class: "catlist", children: ordered.map((r3) => {
        const i3 = rows.indexOf(r3);
        return /* @__PURE__ */ u3("li", { class: r3.parent ? "sub" : "", "data-was": r3.was || void 0, children: [
          /* @__PURE__ */ u3(Mark2, { kind: r3.icon || rows.find((g2) => g2.name === r3.parent)?.icon || void 0, type: r3.icon || rows.find((g2) => g2.name === r3.parent)?.icon || void 0, name: r3.name || "?", size: "sm" }),
          /* @__PURE__ */ u3("input", { "aria-label": "Name", value: r3.name, onInput: (ev) => set2(i3, "name", ev.target.value) }),
          /* @__PURE__ */ u3("select", { "aria-label": `${r3.name || "Category"}'s group`, value: r3.parent, onChange: (ev) => set2(i3, "parent", ev.target.value), children: [
            /* @__PURE__ */ u3("option", { value: "", children: "No group" }),
            groups3.filter((g2) => g2 !== r3 && !rows.some((c3) => c3.parent === r3.name && r3.name)).map((g2) => /* @__PURE__ */ u3("option", { value: g2.name, children: [
              "Under ",
              g2.name
            ] }, g2.name))
          ] }),
          /* @__PURE__ */ u3("select", { "aria-label": `${r3.name || "Category"}'s icon`, value: r3.icon, onChange: (ev) => set2(i3, "icon", ev.target.value), children: categoryIcons.map(([k3, label]) => /* @__PURE__ */ u3("option", { value: k3, children: label }, k3)) }),
          /* @__PURE__ */ u3("button", { type: "button", class: "small", "aria-label": `Delete ${r3.name || "this category"}`, onClick: () => {
            setTouched(true);
            setRows(rows.filter((_3, j3) => j3 !== i3).map((c3) => c3.parent === r3.name ? { ...c3, parent: r3.parent } : c3));
          }, children: "Delete" })
        ] }, i3);
      }) }),
      /* @__PURE__ */ u3("p", { children: /* @__PURE__ */ u3("button", { type: "button", class: "small addded", onClick: add, children: "Add a category" }) }),
      /* @__PURE__ */ u3(Actions3, { busy, exists: false, remove: () => {
      }, close: props.close, problem, touched })
    ] });
  }
  function BudgetsForm(props) {
    const { plan } = props;
    const names2 = (props.categories || []).map((c3) => c3.name);
    const [rows, setRows] = d2(() => (plan.budgets || []).map((b2) => ({ category: b2.category, amount: text(b2.amount), per: b2.per || "month", rollover: !!b2.rollover })));
    const { busy, keep: keep2, touched, watch: watch2 } = useSaving(props);
    const [problem, setProblem] = d2("");
    const set2 = (i3, k3, val) => setRows(rows.map((r3, j3) => j3 === i3 ? { ...r3, [k3]: val } : r3));
    const submit = (e3) => {
      e3.preventDefault();
      const used = rows.filter((r3) => r3.category || r3.amount.trim());
      const cats = used.map((r3) => r3.category.toLowerCase());
      const twice = cats.find((c3, i3) => cats.indexOf(c3) !== i3);
      const wrong = used.some((r3) => !r3.category) ? "Pick each budget's category." : used.some((r3) => !(num(r3.amount) > 0)) ? "Type how much each budget may take." : twice ? `${used.find((r3) => r3.category.toLowerCase() === twice).category} has two budgets.` : "";
      setProblem(wrong);
      if (wrong) return;
      keep2({ ...plan, budgets: used.length ? used.map((r3) => ({ category: r3.category, amount: num(r3.amount), per: r3.per === "paycheck" ? "paycheck" : void 0, rollover: r3.rollover || void 0 })) : void 0 });
    };
    return /* @__PURE__ */ u3("form", { class: "finform", onSubmit: submit, ...watch2, children: [
      /* @__PURE__ */ u3("div", { class: "formhead", children: /* @__PURE__ */ u3("h2", { id: "finSheetTitle", children: "Budgets" }) }),
      /* @__PURE__ */ u3("p", { class: "formsub muted", children: "A budget for a group counts its own categories too (Food counts Groceries and Eating out)." }),
      /* @__PURE__ */ u3("ul", { class: "catlist budgetlist", children: rows.map((r3, i3) => /* @__PURE__ */ u3("li", { children: [
        /* @__PURE__ */ u3("select", { "aria-label": `Budget ${i3 + 1} category`, value: r3.category, onChange: (ev) => set2(i3, "category", ev.target.value), children: [
          /* @__PURE__ */ u3("option", { value: "", children: "Pick a category" }),
          [...new Set([...names2, r3.category].filter(Boolean))].map((n2) => /* @__PURE__ */ u3("option", { value: n2, children: n2 }, n2))
        ] }),
        /* @__PURE__ */ u3("span", { class: "moneyfield", children: [
          /* @__PURE__ */ u3("span", { "aria-hidden": "true", children: currencySign() }),
          /* @__PURE__ */ u3("input", { "aria-label": `Budget ${i3 + 1} amount`, inputmode: "decimal", value: r3.amount, onInput: (ev) => set2(i3, "amount", ev.target.value) })
        ] }),
        /* @__PURE__ */ u3("select", { "aria-label": `Budget ${i3 + 1} per`, value: r3.per, onChange: (ev) => set2(i3, "per", ev.target.value), children: [
          /* @__PURE__ */ u3("option", { value: "month", children: "A month" }),
          /* @__PURE__ */ u3("option", { value: "paycheck", children: "Each paycheck" })
        ] }),
        /* @__PURE__ */ u3("label", { class: "fcheckbox", children: [
          /* @__PURE__ */ u3("input", { type: "checkbox", checked: r3.rollover, onClick: (ev) => set2(i3, "rollover", ev.currentTarget.checked) }),
          " Rolls over"
        ] }),
        /* @__PURE__ */ u3("button", { type: "button", class: "small", "aria-label": `Remove budget ${i3 + 1}`, onClick: () => setRows(rows.filter((_3, j3) => j3 !== i3)), children: "Remove" })
      ] }, i3)) }),
      /* @__PURE__ */ u3("p", { children: /* @__PURE__ */ u3("button", { type: "button", class: "small addded", onClick: () => setRows([...rows, { category: "", amount: "", per: "month", rollover: false }]), children: "Add a budget" }) }),
      /* @__PURE__ */ u3(Actions3, { busy, exists: false, remove: () => {
      }, close: props.close, problem, touched })
    ] });
  }
  function ImportForm(props) {
    const { plan, checking, ledger } = props;
    const accounts = (plan.accounts || []).filter((a3) => !held(a3.kind));
    const file = A2(null);
    const [name, setName] = d2("");
    const [text2, setText] = d2("");
    const [account, setAccount] = d2(checking || accounts[0]?.id || "");
    const [cols, setCols] = d2(null);
    const [busy, setBusy] = d2(false);
    const [problem, setProblem] = d2("");
    const ofx = !!text2 && isOfx(text2);
    const rows = text2 && !ofx ? csvRows(text2) : [];
    const header = rows[0] || [];
    const read = async (f4) => {
      if (!f4) return;
      const t3 = await f4.text();
      setName(f4.name);
      setText(t3);
      setProblem("");
      setCols(isOfx(t3) ? null : guessColumns(csvRows(t3)[0] || []));
    };
    const found = !text2 ? [] : ofx ? fromOfx(text2) : cols && cols.date >= 0 && (cols.amount >= 0 || cols.debit >= 0 || cols.credit >= 0) ? fromCsv(rows, cols) : [];
    const have = ledger?.transactions || [];
    const fresh = found.filter((t3) => !already(t3, account, have));
    const lastCat = (payee) => [...have].reverse().find((q2) => q2.payee && q2.category && q2.payee.toLowerCase() === payee.toLowerCase())?.category;
    const bring = async (e3) => {
      e3.preventDefault();
      if (!fresh.length) {
        setProblem(found.length ? "All of them are in already." : "Nothing in this file reads as a transaction: check the columns.");
        return;
      }
      const added = fresh.map((t3) => ({ id: "", date: t3.date, account, amount: t3.amount, payee: t3.payee || void 0, category: t3.payee && lastCat(t3.payee) || void 0, note: t3.memo || void 0, bank: t3.id }));
      setBusy(true);
      const ok = await props.saveLedger({ ...ledger || { transactions: [] }, transactions: [...have, ...added] });
      setBusy(false);
      if (ok) props.close();
    };
    const colPick = (label, k3) => /* @__PURE__ */ u3(Field, { label, children: /* @__PURE__ */ u3("select", { value: cols?.[k3] ?? -1, onChange: (e3) => setCols({ ...cols, [k3]: Number(e3.target.value) }), children: [
      /* @__PURE__ */ u3("option", { value: -1, children: "None" }),
      header.map((h3, i3) => /* @__PURE__ */ u3("option", { value: i3, children: h3 || `Column ${i3 + 1}` }, i3))
    ] }) });
    return /* @__PURE__ */ u3("form", { class: "finform finimport", onSubmit: bring, children: [
      /* @__PURE__ */ u3("div", { class: "formhead", children: /* @__PURE__ */ u3("h2", { id: "finSheetTitle", children: "Import a bank's file" }) }),
      /* @__PURE__ */ u3("p", { class: "formsub muted", children: "A CSV or an OFX/QFX file from your bank's website. It is read on this device and kept only in your ledger." }),
      /* @__PURE__ */ u3("div", { class: "formgrid", children: [
        /* @__PURE__ */ u3(Field, { label: "File", children: /* @__PURE__ */ u3("span", { class: "importfile", children: [
          /* @__PURE__ */ u3("input", { ref: file, type: "file", accept: ".csv,.ofx,.qfx,text/csv", hidden: true, onChange: (e3) => read(e3.currentTarget.files?.[0]) }),
          /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: () => file.current?.click(), children: name ? "Pick another file" : "Pick a file" }),
          name && /* @__PURE__ */ u3("span", { class: "muted", children: name })
        ] }) }),
        /* @__PURE__ */ u3(AccountSelect, { label: "Into the ledger of", value: account, set: setAccount, accounts }),
        cols && /* @__PURE__ */ u3(S, { children: [
          colPick("Day", "date"),
          colPick("Amount", "amount"),
          cols.amount < 0 && colPick("Money out", "debit"),
          cols.amount < 0 && colPick("Money in", "credit"),
          colPick("Payee", "payee")
        ] })
      ] }),
      !!text2 && /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3("h3", { class: "formsub", children: [
          found.length ? `${fresh.length} to bring in` : "Nothing found yet",
          " ",
          /* @__PURE__ */ u3("span", { class: "muted", children: found.length - fresh.length ? `${found.length - fresh.length} already in, skipped` : "" })
        ] }),
        /* @__PURE__ */ u3("ul", { class: "importlist", children: found.slice(0, 60).map((t3, i3) => {
          const dup = !fresh.includes(t3);
          return /* @__PURE__ */ u3("li", { class: dup ? "dup" : "", children: [
            /* @__PURE__ */ u3(Mark2, { brand: brandOf(void 0, t3.payee), name: t3.payee || "?", size: "sm" }),
            /* @__PURE__ */ u3("span", { class: "grow", children: [
              /* @__PURE__ */ u3("strong", { children: t3.payee || "No payee" }),
              /* @__PURE__ */ u3("small", { children: [
                dayLong(t3.date),
                dup ? " · already in" : t3.payee && lastCat(t3.payee) ? ` · ${lastCat(t3.payee)}` : ""
              ] })
            ] }),
            /* @__PURE__ */ u3("span", { class: t3.amount > 0 ? "fx-in" : "", children: signed(t3.amount) })
          ] }, i3);
        }) }),
        found.length > 60 && /* @__PURE__ */ u3("p", { class: "muted", children: [
          "And ",
          found.length - 60,
          " more."
        ] })
      ] }),
      problem && /* @__PURE__ */ u3("p", { class: "formerr bad", role: "alert", children: problem }),
      /* @__PURE__ */ u3("div", { class: "actions finactions", children: [
        /* @__PURE__ */ u3("span", { class: "grow" }),
        /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: props.close, disabled: busy, children: "Cancel" }),
        /* @__PURE__ */ u3("button", { type: "submit", class: "primary small", disabled: busy || !fresh.length, children: fresh.length ? `Bring in ${fresh.length}` : "Bring in" })
      ] })
    ] });
  }
  function FinanceSheet({ edit }) {
    return /* @__PURE__ */ u3(Sheet, { id: "finSheet", titleId: "finSheetTitle", children: [
      edit?.what === "payment" && /* @__PURE__ */ u3(PaymentForm, { ...edit }, "p" + edit.n),
      edit?.what === "account" && /* @__PURE__ */ u3(AccountForm, { ...edit }, "a" + edit.n),
      edit?.what === "person" && /* @__PURE__ */ u3(PersonForm, { ...edit }, "e" + edit.n),
      edit?.what === "balances" && /* @__PURE__ */ u3(BalancesForm, { ...edit }, "b" + edit.n),
      edit?.what === "transaction" && /* @__PURE__ */ u3(TransactionForm, { ...edit }, "t" + edit.n),
      edit?.what === "categories" && /* @__PURE__ */ u3(CategoriesForm, { ...edit }, "c" + edit.n),
      edit?.what === "budgets" && /* @__PURE__ */ u3(BudgetsForm, { ...edit }, "g" + edit.n),
      edit?.what === "import" && /* @__PURE__ */ u3(ImportForm, { ...edit }, "i" + edit.n),
      !edit && /* @__PURE__ */ u3("h2", { id: "finSheetTitle", children: "Finances" })
    ] });
  }
  function mountFinanceSheet(el, edit) {
    R(/* @__PURE__ */ u3(FinanceSheet, { edit }), el);
  }

  // web/src/finances/model.ts
  function month(v3, L2) {
    const people = v3.plan.people || [];
    const payments = allPayments(v3.plan);
    const income = people.reduce((t3, e3) => t3 + e3.net * perMonth(e3.schedule), 0);
    const kept = (id2) => saving(L2.account[id2 || ""]?.kind);
    const onCard = (x2) => L2.account[x2.from || ""]?.kind === "card";
    const fromPay = payments.filter((x2) => (!x2.from || x2.from === v3.checking || onCard(x2)) && !(x2.to && x2.to === v3.checking));
    const each = (x2) => x2.amount * perMonth(x2.schedule, people, v3.checking);
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
    // A brokerage, a Roth or traditional IRA, and a 401(k) are all Investments.
    { key: "investments", name: "Investments", kinds: ["investment", "retirement"], color: 2 },
    { key: "property", name: "Home & Car", kinds: ["home", "car"], color: 4 },
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
  function worthByMonth(v3, back = 3, ahead = 3) {
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
    for (let i3 = 1; i3 <= ahead; i3++) {
      const end = isoDay(new Date(today.getFullYear(), today.getMonth() + i3 + 1, 0));
      if (!v3.periods.some((q2) => q2.last >= end)) break;
      const p3 = [...v3.periods].reverse().find((q2) => q2.last <= end && q2.accounts);
      if (!p3) break;
      out.push({ date: end, ahead: true, ...split2((a3) => p3.accounts[a3.id] ?? todayOf(v3, a3)) });
    }
    return out;
  }
  var checkingDays = (v3, n2 = 31) => (v3.days || []).slice(0, n2);

  // web/src/finances/Calendar.tsx
  var shownMarks = 3;
  var monthOf = (day3) => day3.slice(0, 7);
  var addMonths = (month3, n2) => {
    const d3 = parseDay(month3 + "-01");
    return isoDay(new Date(d3.getFullYear(), d3.getMonth() + n2, 1)).slice(0, 7);
  };
  var addDays = (day3, n2) => {
    const d3 = parseDay(day3);
    return isoDay(new Date(d3.getFullYear(), d3.getMonth(), d3.getDate() + n2));
  };
  var monthTitle = (month3) => parseDay(month3 + "-01").toLocaleDateString(void 0, { month: "long", year: "numeric" });
  var weekday = (day3, form2) => parseDay(day3).toLocaleDateString(void 0, { weekday: form2 });
  function daysOf(v3) {
    const cushion = v3.plan.cushion || 0;
    const moved = {};
    for (const p3 of v3.paydays || []) if (p3.moved?.length) moved[p3.date] = p3.moved;
    const out = {};
    for (const d3 of v3.days || []) out[d3.date] = { date: d3.date, balance: d3.balance, events: d3.events || [], holiday: v3.holidays?.[d3.date], moved: moved[d3.date] || [], low: !!cushion && d3.balance < cushion };
    return out;
  }
  var named4 = (e3, L2) => e3.people?.length ? e3.people.map((id2) => L2.person[id2]?.name || id2).join(" and ") + "'s paycheck" : L2.payment[e3.payment || ""]?.name || e3.payment || "";
  function Lead({ e: e3, L: L2, size }) {
    if (e3.people?.length) return /* @__PURE__ */ u3("span", { class: "fwhos", children: e3.people.map((id2) => /* @__PURE__ */ u3(Who, { name: L2.person[id2]?.name, n: L2.order[id2] ?? 0, size }, id2)) });
    const x2 = L2.payment[e3.payment || ""];
    return /* @__PURE__ */ u3(PayMark, { x: x2, size });
  }
  var movedText = (m3, L2) => `${L2.person[m3.person]?.name || m3.person}'s payday moved from ${dayLong(m3.from)}: ${m3.why}`;
  function dayLabel(d3, L2, cushion) {
    const said = d3.events.map((e3) => `${named4(e3, L2)} ${signed(e3.amount)}`);
    return [
      dayLong(d3.date) + (d3.holiday ? `, ${d3.holiday}` : ""),
      said.length ? said.join(", ") : "nothing comes or goes",
      `checking ${money(d3.balance)} after` + (d3.low ? `, under your ${compact(cushion)} cushion` : "")
    ].join(". ");
  }
  function Calendar({ v: v3, L: L2, edit }) {
    const days = daysOf(v3);
    const dates = Object.keys(days).sort();
    const first = dates[0] || v3.today, last = dates[dates.length - 1] || v3.today;
    const [month3, setMonth] = d2(monthOf(first));
    const [sel2, setSel] = d2(first);
    const focusing = A2("");
    const grid = A2(null);
    h2(() => {
      if (!focusing.current) return;
      grid.current?.querySelector(`button[data-day="${focusing.current}"]`)?.focus();
      focusing.current = "";
    });
    const cushion = v3.plan.cushion || 0;
    if (!dates.length) return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3(Widget, { title: "Calendar", span: "all", children: /* @__PURE__ */ u3(Empty, { children: "Nothing to show yet: add a checking account, a paycheck, and the payments that repeat." }) }) });
    const go2 = (day3, focus = false) => {
      const d3 = day3 < first ? first : day3 > last ? last : day3;
      setSel(d3);
      setMonth(monthOf(d3));
      if (focus) focusing.current = d3;
    };
    const turn = (n2) => {
      const m3 = addMonths(month3, n2);
      setMonth(m3);
      const want = m3 + sel2.slice(7);
      setSel(want < first ? first : want > last ? last : days[want] ? want : last);
    };
    const keys2 = (e3) => {
      const day3 = sel2;
      const step2 = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (step2[e3.key]) go2(addDays(day3, step2[e3.key]), true);
      else if (e3.key === "PageUp" || e3.key === "PageDown") {
        const m3 = addMonths(monthOf(day3), e3.key === "PageUp" ? -1 : 1);
        go2(m3 + day3.slice(7) > last ? last : m3 + day3.slice(7), true);
      } else if (e3.key === "Home") go2(addDays(day3, -col(day3)), true);
      else if (e3.key === "End") go2(addDays(day3, 6 - col(day3)), true);
      else return;
      e3.preventDefault();
    };
    const monday = v3.plan.holidays === "uk";
    const col = (day3) => (parseDay(day3).getDay() + (monday ? 6 : 0)) % 7;
    const start = month3 + "-01";
    const inMonth = [];
    for (let d3 = start; monthOf(d3) === month3; d3 = addDays(d3, 1)) inMonth.push(d3);
    const cells = [...Array(col(start)).fill(null), ...inMonth];
    while (cells.length % 7) cells.push(null);
    const weeks = [];
    for (let i3 = 0; i3 < cells.length; i3 += 7) weeks.push(cells.slice(i3, i3 + 7));
    const heads = Array.from({ length: 7 }, (_3, i3) => addDays("2026-11-01", (i3 + (monday ? 1 : 0)) % 7));
    const picked = days[sel2];
    const lowCount = inMonth.filter((d3) => days[d3]?.low).length;
    return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3("div", { class: "fx-board fx-calboard", children: [
      /* @__PURE__ */ u3(
        Widget,
        {
          title: monthTitle(month3),
          span: 2,
          kind: "fx-calendar",
          actions: /* @__PURE__ */ u3(S, { children: [
            /* @__PURE__ */ u3("button", { type: "button", class: "small", disabled: monthOf(v3.today) === month3 && sel2 === (days[v3.today] ? v3.today : first), onClick: () => go2(days[v3.today] ? v3.today : first), children: "Today" }),
            /* @__PURE__ */ u3(IconButton, { icon: "prev", label: "The month before", onClick: () => turn(-1), disabled: month3 <= monthOf(first) }),
            /* @__PURE__ */ u3(IconButton, { icon: "next", label: "The month after", onClick: () => turn(1), disabled: month3 >= monthOf(last) })
          ] }),
          children: [
            /* @__PURE__ */ u3("p", { class: "fx-sub fx-lead", children: lowCount ? `Checking falls under your ${compact(cushion)} cushion on ${lowCount === 1 ? "1 day" : `${lowCount} days`} this month.` : `From today to ${dayShort(last)}, as far as Finances reads ahead.` }),
            /* @__PURE__ */ u3("table", { class: "fx-month", ref: grid, "aria-label": `${monthTitle(month3)}: paydays, payments, and checking each day`, children: [
              /* @__PURE__ */ u3("thead", { children: /* @__PURE__ */ u3("tr", { children: heads.map((d3) => /* @__PURE__ */ u3("th", { scope: "col", abbr: weekday(d3, "long"), children: weekday(d3, "short") }, d3)) }) }),
              /* @__PURE__ */ u3("tbody", { children: weeks.map((w3, i3) => /* @__PURE__ */ u3("tr", { children: w3.map((d3, k3) => {
                if (!d3) return /* @__PURE__ */ u3("td", { class: "fx-blank" }, k3);
                const info = days[d3];
                const n2 = Number(d3.slice(8));
                if (!info) return /* @__PURE__ */ u3("td", { class: "fx-off", children: [
                  /* @__PURE__ */ u3("span", { class: "fx-daynum", children: [
                    /* @__PURE__ */ u3("span", { class: "fx-hidden", children: [
                      dayLong(d3),
                      ", before today or past what Finances reads ahead"
                    ] }),
                    /* @__PURE__ */ u3("span", { "aria-hidden": "true", children: n2 })
                  ] }),
                  v3.holidays?.[d3] && /* @__PURE__ */ u3("span", { class: "fx-hol", children: v3.holidays[d3] })
                ] }, k3);
                const pays = info.events.filter((e3) => e3.people?.length), bills = info.events.filter((e3) => !e3.people?.length);
                const marks2 = [...pays, ...bills];
                return /* @__PURE__ */ u3("td", { class: (info.low ? "fx-low" : "") + (d3 === v3.today ? " fx-today" : ""), children: /* @__PURE__ */ u3(
                  "button",
                  {
                    type: "button",
                    class: "fx-day",
                    "data-day": d3,
                    "aria-pressed": d3 === sel2,
                    tabIndex: d3 === sel2 ? 0 : -1,
                    onClick: () => setSel(d3),
                    onKeyDown: keys2,
                    children: [
                      /* @__PURE__ */ u3("span", { class: "fx-hidden", children: dayLabel(info, L2, cushion) }),
                      /* @__PURE__ */ u3("span", { class: "fx-daynum", "aria-hidden": "true", children: [
                        n2,
                        !!info.moved.length && /* @__PURE__ */ u3("span", { class: "fx-movedtag", children: "moved" })
                      ] }),
                      info.holiday && /* @__PURE__ */ u3("span", { class: "fx-hol", "aria-hidden": "true", children: info.holiday }),
                      /* @__PURE__ */ u3("span", { class: "fx-daymarks", "aria-hidden": "true", children: [
                        marks2.slice(0, shownMarks).map((e3, j3) => /* @__PURE__ */ u3(Lead, { e: e3, L: L2, size: "sm" }, j3)),
                        marks2.length > shownMarks && /* @__PURE__ */ u3("span", { class: "fx-moremarks", children: [
                          "+",
                          marks2.length - shownMarks
                        ] })
                      ] }),
                      /* @__PURE__ */ u3("span", { class: "fx-daybal" + (info.low ? " fx-out" : ""), "aria-hidden": "true", children: compact(info.balance) })
                    ]
                  }
                ) }, k3);
              }) }, i3)) })
            ] }),
            /* @__PURE__ */ u3("ul", { class: "fx-legend inline fx-callegend", "aria-hidden": "true", children: [
              /* @__PURE__ */ u3("li", { children: [
                /* @__PURE__ */ u3("span", { class: "fx-key fx-keylow" }),
                /* @__PURE__ */ u3("span", { class: "fx-legendlabel", children: cushion ? `Under your ${compact(cushion)} cushion` : "Checking at the end of the day" })
              ] }),
              /* @__PURE__ */ u3("li", { children: [
                /* @__PURE__ */ u3("span", { class: "fx-key fx-keyhol" }),
                /* @__PURE__ */ u3("span", { class: "fx-legendlabel", children: "Bank holiday" })
              ] }),
              /* @__PURE__ */ u3("li", { children: [
                /* @__PURE__ */ u3("span", { class: "fx-movedtag", children: "moved" }),
                /* @__PURE__ */ u3("span", { class: "fx-legendlabel", children: "A payday moved before a weekend or holiday" })
              ] })
            ] }),
            /* @__PURE__ */ u3(WeekList, { v: v3, L: L2, days, inMonth, col, cushion, edit })
          ]
        }
      ),
      picked && /* @__PURE__ */ u3(DayCard, { v: v3, L: L2, d: picked, cushion, edit })
    ] }) });
  }
  function DayCard({ v: v3, L: L2, d: d3, cushion, edit }) {
    return /* @__PURE__ */ u3(Widget, { title: dayLong(d3.date) + (d3.date === v3.today ? ", today" : ""), kind: "fx-dayone", children: [
      /* @__PURE__ */ u3(
        Stat,
        {
          value: /* @__PURE__ */ u3(Amount, { value: d3.balance, tone: d3.balance < 0 ? "out" : d3.low ? "warn" : "" }),
          caption: /* @__PURE__ */ u3(S, { children: [
            "In checking at the end of the day",
            d3.low && /* @__PURE__ */ u3("span", { children: [
              ", under your ",
              compact(cushion),
              " cushion"
            ] })
          ] })
        }
      ),
      (d3.holiday || !!d3.moved.length) && /* @__PURE__ */ u3("p", { class: "fx-sub fx-daynote", children: [d3.holiday && `${d3.holiday}: the banks are closed.`, ...d3.moved.map((m3) => movedText(m3, L2) + ".")].filter(Boolean).join(" ") }),
      /* @__PURE__ */ u3(DayRows, { L: L2, d: d3, edit })
    ] });
  }
  function DayRows({ L: L2, d: d3, edit }) {
    return /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: [
      d3.events.map((e3, i3) => {
        const x2 = L2.payment[e3.payment || ""];
        return /* @__PURE__ */ u3(
          Row,
          {
            lead: /* @__PURE__ */ u3(Lead, { e: e3, L: L2 }),
            title: named4(e3, L2),
            sub: e3.people?.length ? "Paycheck" : x2?.card ? "The card's balance" : kindName(x2?.kind || "other"),
            when: /* @__PURE__ */ u3(Amount, { value: e3.amount, sign: true, tone: e3.amount > 0 ? "in" : "", form: "full" }),
            whenPlain: true,
            onOpen: edit && x2 ? () => edit("payment", x2.id) : void 0,
            openLabel: x2 && edit ? "edit" : void 0
          },
          i3
        );
      }),
      !d3.events.length && /* @__PURE__ */ u3("li", { children: /* @__PURE__ */ u3(Empty, { children: "Nothing comes or goes." }) })
    ] });
  }
  function WeekList({ v: v3, L: L2, days, inMonth, col, cushion, edit }) {
    const busy = inMonth.filter((d3) => days[d3] && (days[d3].events.length || days[d3].holiday || days[d3].low));
    const weeks = [];
    let from = "";
    for (const d3 of busy) {
      const w3 = addDays(d3, -col(d3));
      if (w3 !== from) {
        weeks.push([]);
        from = w3;
      }
      weeks[weeks.length - 1].push(d3);
    }
    return /* @__PURE__ */ u3("div", { class: "fx-weeks", children: [
      weeks.map((w3) => /* @__PURE__ */ u3("section", { class: "fx-week", "aria-label": `Week of ${dayShort(w3[0])}`, children: w3.map((d3) => {
        const info = days[d3];
        return /* @__PURE__ */ u3("div", { class: "fx-weekday" + (info.low ? " fx-low" : ""), children: [
          /* @__PURE__ */ u3("h3", { children: [
            /* @__PURE__ */ u3("span", { children: [
              dayLong(d3),
              d3 === v3.today ? ", today" : "",
              info.holiday ? ` · ${info.holiday}` : ""
            ] }),
            /* @__PURE__ */ u3("span", { class: "fx-daybal" + (info.low ? " fx-out" : ""), children: [
              money(info.balance),
              /* @__PURE__ */ u3("span", { class: "fx-sub", children: [
                " after",
                info.low ? `, under ${compact(cushion)}` : ""
              ] })
            ] })
          ] }),
          !!info.moved.length && /* @__PURE__ */ u3("p", { class: "fx-sub fx-daynote", children: [
            info.moved.map((m3) => movedText(m3, L2)).join(". "),
            "."
          ] }),
          !!info.events.length && /* @__PURE__ */ u3(DayRows, { L: L2, d: info, edit })
        ] }, d3);
      }) }, w3[0])),
      !busy.length && /* @__PURE__ */ u3(Empty, { children: "Nothing comes or goes this month." })
    ] });
  }

  // web/src/finances/ui/Legend.tsx
  var hue = (h3) => typeof h3 === "number" ? `fx-h${h3}` : `fx-h-${h3}`;
  function Dot({ color, shape = "round" }) {
    return /* @__PURE__ */ u3("span", { class: `fx-dot ${shape} ${hue(color)}`, "aria-hidden": "true" });
  }
  function SplitBar({ parts: parts2, label, size = "md" }) {
    const total = parts2.reduce((t3, p3) => t3 + Math.max(0, p3.value), 0);
    const said = parts2.filter((p3) => p3.value > 0).map((p3) => `${p3.label} ${Math.round(p3.value / (total || 1) * 100)}%`).join(", ");
    return /* @__PURE__ */ u3("div", { class: "fx-split " + size, role: "img", "aria-label": `${label}: ${said}`, children: parts2.filter((p3) => p3.value > 0).map((p3) => /* @__PURE__ */ u3("span", { class: hue(p3.color), style: { flexGrow: p3.value } }, p3.label)) });
  }
  function Legend({ items, layout = "list" }) {
    return /* @__PURE__ */ u3("ul", { class: "fx-legend " + layout, children: items.map((it, i3) => /* @__PURE__ */ u3("li", { children: [
      /* @__PURE__ */ u3(Dot, { color: it.color, shape: it.shape }),
      /* @__PURE__ */ u3("span", { class: "fx-legendlabel", children: it.label }),
      it.note !== void 0 && /* @__PURE__ */ u3("span", { class: "fx-sub", children: it.note }),
      it.value !== void 0 && /* @__PURE__ */ u3("span", { class: "fx-legendvalue", children: it.value })
    ] }, i3)) });
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

  // web/src/finances/reportData.ts
  function ranges(today, first) {
    const d3 = parseDay(today);
    const month3 = (n2) => isoDay(new Date(d3.getFullYear(), d3.getMonth() + n2, 1));
    const end = (n2) => isoDay(new Date(d3.getFullYear(), d3.getMonth() + n2 + 1, 0));
    return [
      { key: "month", label: "This month", from: month3(0), to: end(0) },
      { key: "last", label: "Last month", from: month3(-1), to: end(-1) },
      { key: "three", label: "3 months", from: month3(-2), to: end(0) },
      { key: "year", label: "This year", from: `${d3.getFullYear()}-01-01`, to: `${d3.getFullYear()}-12-31` },
      { key: "all", label: "All", from: first < month3(0) ? first : month3(0), to: end(0) }
    ];
  }
  var inRange = (t3, r3) => t3.date >= r3.from && t3.date <= r3.to;
  function parts(t3, income) {
    if (t3.to) return [];
    const list = t3.splits?.length ? t3.splits.map((s3) => ({ category: s3.category, amount: s3.amount })) : [{ category: t3.category || "No category", amount: t3.amount }];
    return list.filter((p3) => !(p3.amount > 0 && income.has(p3.category.toLowerCase()))).map((p3) => ({ category: p3.category, amount: -p3.amount }));
  }
  function incomeOf(cats) {
    const top = new Set(cats.filter((c3) => c3.income && !c3.parent).map((c3) => c3.name.toLowerCase()));
    return new Set(cats.filter((c3) => c3.income || top.has((c3.parent || "").toLowerCase())).map((c3) => c3.name.toLowerCase()));
  }
  function byCategory(txs, cats, r3) {
    const income = incomeOf(cats);
    const parent = new Map(cats.map((c3) => [c3.name.toLowerCase(), c3.parent || ""]));
    const name = new Map(cats.map((c3) => [c3.name.toLowerCase(), c3.name]));
    const groups3 = /* @__PURE__ */ new Map();
    for (const t3 of txs) {
      if (!inRange(t3, r3)) continue;
      for (const p3 of parts(t3, income)) {
        const key2 = p3.category.toLowerCase();
        const g2 = parent.get(key2) || name.get(key2) || p3.category;
        const top = groups3.get(g2) || { name: g2, amount: 0, children: [] };
        top.amount += p3.amount;
        if (parent.get(key2)) {
          const child = top.children.find((c3) => c3.name.toLowerCase() === key2) || (top.children.push({ name: name.get(key2) || p3.category, amount: 0 }), top.children.at(-1));
          child.amount += p3.amount;
        }
        groups3.set(g2, top);
      }
    }
    const round = (n2) => Math.round(n2 * 100) / 100;
    return [...groups3.values()].map((g2) => ({ ...g2, amount: round(g2.amount), children: g2.children.map((c3) => ({ ...c3, amount: round(c3.amount) })).filter((c3) => Math.abs(c3.amount) >= 5e-3).sort((a3, b2) => b2.amount - a3.amount) })).filter((g2) => g2.amount >= 5e-3).sort((a3, b2) => b2.amount - a3.amount);
  }
  function byMonth(txs, r3) {
    const out = [];
    for (let d3 = parseDay(r3.from.slice(0, 7) + "-01"); isoDay(d3) <= r3.to; d3 = new Date(d3.getFullYear(), d3.getMonth() + 1, 1)) {
      const m3 = isoDay(d3).slice(0, 7);
      const list = txs.filter((t3) => !t3.to && t3.date.startsWith(m3));
      out.push({ month: m3, label: monthName(m3 + "-01").slice(0, 3), in: list.filter((t3) => t3.amount > 0).reduce((s3, t3) => s3 + t3.amount, 0), out: -list.filter((t3) => t3.amount < 0).reduce((s3, t3) => s3 + t3.amount, 0) });
    }
    return out;
  }
  function topPayees(txs, r3, n2 = 5) {
    const by = /* @__PURE__ */ new Map();
    for (const t3 of txs) {
      if (t3.to || t3.amount >= 0 || !inRange(t3, r3) || !t3.payee) continue;
      const key2 = t3.payee.toLowerCase();
      const p3 = by.get(key2) || { payee: t3.payee, amount: 0, count: 0 };
      p3.amount -= t3.amount;
      p3.count++;
      by.set(key2, p3);
    }
    return [...by.values()].sort((a3, b2) => b2.amount - a3.amount).slice(0, n2);
  }
  function totals(txs, r3) {
    const list = txs.filter((t3) => !t3.to && inRange(t3, r3));
    return { in: list.filter((t3) => t3.amount > 0).reduce((s3, t3) => s3 + t3.amount, 0), out: -list.filter((t3) => t3.amount < 0).reduce((s3, t3) => s3 + t3.amount, 0) };
  }

  // web/src/finances/Reports.tsx
  function Reports({ v: v3, ledger }) {
    const [key2, setKey] = d2("month");
    if (!ledger) return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3(Empty, { children: "Reading…" }) });
    const txs = ledger.transactions;
    const all = ranges(v3.today, txs[0]?.date || v3.today);
    const r3 = all.find((x2) => x2.key === key2) || all[0];
    const sum = totals(txs, r3);
    const groups3 = byCategory(txs, v3.categories || [], r3);
    const months = byMonth(txs, r3);
    const payees = topPayees(txs, r3);
    const most = groups3[0]?.amount || 1;
    const spent = groups3.reduce((s3, g2) => s3 + g2.amount, 0);
    return /* @__PURE__ */ u3("div", { class: "fin", children: /* @__PURE__ */ u3("div", { class: "fx-board", children: [
      /* @__PURE__ */ u3(Widget, { title: "Reports", span: "all", kind: "fx-reportsum", actions: /* @__PURE__ */ u3(Segmented, { label: "Which stretch", value: r3.key, pick: setKey, options: all.map((x2) => [x2.key, x2.label]) }), children: /* @__PURE__ */ u3("div", { class: "fx-stats", children: [
        /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: sum.in, form: "whole", tone: "in" }), caption: "Money in" }),
        /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: sum.out, form: "whole", tone: "out" }), caption: "Money out" }),
        /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: sum.in - sum.out, form: "whole", sign: true, tone: "auto" }), caption: sum.in >= sum.out ? "Kept" : "More out than in" })
      ] }) }),
      !txs.length ? /* @__PURE__ */ u3(Widget, { title: "Nothing yet", span: "all", children: /* @__PURE__ */ u3(Empty, { children: "Reports read the transactions: add some on Transactions, and they show here." }) }) : /* @__PURE__ */ u3(S, { children: [
        /* @__PURE__ */ u3(Widget, { title: "Spending by category", kind: "fx-bycat", children: groups3.length ? /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: groups3.map((g2) => {
          const icon = iconOf(v3.categories, g2.name);
          return /* @__PURE__ */ u3(
            Row,
            {
              lead: /* @__PURE__ */ u3(Mark2, { kind: icon, type: icon, name: g2.name }),
              title: g2.name,
              sub: g2.children.length ? g2.children.map((c3) => `${c3.name} ${money(c3.amount)}`).join(" · ") : `${Math.round(g2.amount / (spent || 1) * 100)}% of the spending`,
              when: /* @__PURE__ */ u3(Amount, { value: g2.amount, form: "full" }),
              whenPlain: true,
              children: /* @__PURE__ */ u3("span", { class: "fx-budgetbar fx-catbar", "aria-hidden": "true", children: /* @__PURE__ */ u3("span", { style: { width: `${Math.max(1, g2.amount / most * 100)}%` } }) })
            },
            g2.name
          );
        }) }) : /* @__PURE__ */ u3(Empty, { children: "Nothing spent in this stretch." }) }),
        /* @__PURE__ */ u3(Widget, { title: "Where it went", kind: "fx-payees", children: payees.length ? /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: payees.map((p3) => /* @__PURE__ */ u3(
          Row,
          {
            lead: /* @__PURE__ */ u3(Mark2, { brand: brandOf(void 0, p3.payee), name: p3.payee }),
            title: p3.payee,
            sub: plural2(p3.count, "time"),
            when: /* @__PURE__ */ u3(Amount, { value: p3.amount, form: "full" }),
            whenPlain: true
          },
          p3.payee
        )) }) : /* @__PURE__ */ u3(Empty, { children: "Nothing paid out in this stretch." }) }),
        months.length > 1 && /* @__PURE__ */ u3(Widget, { title: "In and out, month by month", span: "all", kind: "fx-inout", children: [
          /* @__PURE__ */ u3(
            StackedBars,
            {
              format: tick,
              height: 220,
              label: `Money in above the line and out below it, each month ${r3.label.toLowerCase()}; the line is what was kept. The table under it has every number.`,
              columns: months.map((m3) => ({ label: m3.label, up: [{ value: m3.in, color: "in" }], down: [{ value: m3.out, color: "out" }], line: m3.in - m3.out })),
              tip: (i3) => /* @__PURE__ */ u3(S, { children: [
                /* @__PURE__ */ u3("div", { class: "fx-caption", children: [
                  months[i3].label,
                  " ",
                  months[i3].month.slice(0, 4)
                ] }),
                /* @__PURE__ */ u3("div", { class: "fx-tiprow", children: [
                  /* @__PURE__ */ u3(Dot, { color: "in" }),
                  /* @__PURE__ */ u3("span", { children: "Money in" }),
                  /* @__PURE__ */ u3(Amount, { value: months[i3].in, form: "full" })
                ] }),
                /* @__PURE__ */ u3("div", { class: "fx-tiprow", children: [
                  /* @__PURE__ */ u3(Dot, { color: "out" }),
                  /* @__PURE__ */ u3("span", { children: "Money out" }),
                  /* @__PURE__ */ u3(Amount, { value: -months[i3].out, form: "full" })
                ] }),
                /* @__PURE__ */ u3("div", { class: "fx-tiptotal", children: [
                  /* @__PURE__ */ u3("span", { children: "Kept" }),
                  /* @__PURE__ */ u3(Amount, { value: months[i3].in - months[i3].out, form: "full" })
                ] })
              ] })
            }
          ),
          /* @__PURE__ */ u3("table", { class: "sr", children: [
            /* @__PURE__ */ u3("caption", { children: "Money in and out by month" }),
            /* @__PURE__ */ u3("thead", { children: /* @__PURE__ */ u3("tr", { children: [
              /* @__PURE__ */ u3("th", { scope: "col", children: "Month" }),
              /* @__PURE__ */ u3("th", { scope: "col", children: "In" }),
              /* @__PURE__ */ u3("th", { scope: "col", children: "Out" })
            ] }) }),
            /* @__PURE__ */ u3("tbody", { children: months.map((m3) => /* @__PURE__ */ u3("tr", { children: [
              /* @__PURE__ */ u3("th", { scope: "row", children: [
                m3.label,
                " ",
                m3.month.slice(0, 4)
              ] }),
              /* @__PURE__ */ u3("td", { children: money(m3.in) }),
              /* @__PURE__ */ u3("td", { children: money(m3.out) })
            ] }, m3.month)) })
          ] })
        ] })
      ] })
    ] }) });
  }

  // web/src/finances/widgets/Subscriptions.tsx
  var justPaid = 3;
  function dueOf(v3, id2) {
    const next = v3.next?.[id2], last = v3.last?.[id2];
    const d3 = next ? daysBetween(v3.today, next) : -1;
    if (d3 === 0) return { text: "Due today", tone: "warn", days: 0 };
    if (d3 === 1) return { text: "Due tomorrow", tone: "warn", days: 1 };
    if (last && daysBetween(last, v3.today) <= justPaid) return { text: "Just paid", tone: "in", days: d3 };
    if (d3 > 1 && d3 <= 30) return { text: `In ${plural2(d3, "day")}`, tone: d3 <= 7 ? "muted" : "", days: d3 };
    if (d3 > 30) return { text: dayLong(next) + (next.slice(0, 4) !== v3.today.slice(0, 4) ? ", " + next.slice(0, 4) : ""), tone: "", days: d3 };
    return { text: "Nothing ahead", tone: "", days: -1 };
  }
  function SubscriptionsSummary({ v: v3, L: L2, edit }) {
    const people = v3.plan.people || [];
    const subs = (v3.plan.payments || []).filter((x2) => x2.kind === "subscriptions").map((x2) => {
      const month4 = x2.amount * perMonth(x2.schedule, people, v3.checking);
      return { x: x2, month: month4, year: month4 * 12, due: dueOf(v3, x2.id) };
    }).sort((a3, b2) => b2.year - a3.year || a3.x.name.localeCompare(b2.x.name));
    if (!subs.length) return /* @__PURE__ */ u3(Empty, { children: edit ? "No subscriptions yet: add one with Add a payment, its category Subscriptions." : "No subscriptions yet." });
    const sum = (list) => list.reduce((t3, s3) => t3 + s3.year, 0);
    const total = sum(subs);
    const soon = (n2) => subs.filter((s3) => s3.due.days >= 0 && s3.due.days <= n2);
    const yearly = subs.filter((s3) => s3.x.schedule.every === "year");
    const week2 = soon(7), month3 = soon(30);
    const charge = (list) => list.reduce((t3, s3) => t3 + s3.x.amount, 0);
    const order2 = subTypes.map(([k3]) => k3);
    const types = Object.entries(subs.reduce((m3, s3) => {
      const t3 = typeOf(s3.x);
      m3[t3] = (m3[t3] || 0) + s3.year;
      return m3;
    }, {})).map(([type, year]) => ({ type, year })).sort((a3, b2) => b2.year - a3.year || order2.indexOf(a3.type) - order2.indexOf(b2.type));
    if (types.length > 8) {
      const kept = types.filter((t3) => t3.type !== "other").slice(0, 7);
      const rest = types.filter((t3) => !kept.includes(t3));
      types.splice(0, types.length, ...kept, { type: "other", year: rest.reduce((t3, x2) => t3 + x2.year, 0) });
    }
    return /* @__PURE__ */ u3("div", { class: "fx-subs", children: [
      /* @__PURE__ */ u3("div", { class: "fx-stats", children: [
        /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: total / 12, form: "whole" }), caption: `A month · ${plural2(subs.length, "subscription")}` }),
        /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: total, form: "whole" }), caption: "A year" }),
        /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: charge(week2), form: "whole", tone: week2.length ? "warn" : "" }), caption: week2.length ? `Renewing in 7 days · ${week2.length}` : "Nothing renews in 7 days" }),
        /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: charge(month3), form: "whole" }), caption: month3.length ? `In 30 days · ${month3.length}` : "Nothing renews in 30 days" })
      ] }),
      !!yearly.length && /* @__PURE__ */ u3("p", { class: "fx-sub fx-subsplit", children: [
        "Paid yearly: ",
        plural2(yearly.length, "subscription"),
        ", ",
        whole(sum(yearly)),
        " a year. Paid more often: ",
        subs.length - yearly.length,
        ", ",
        whole(total - sum(yearly)),
        " a year."
      ] }),
      types.length > 1 && /* @__PURE__ */ u3("div", { class: "fx-subtypes", children: [
        /* @__PURE__ */ u3(SplitBar, { size: "sm", label: "Subscriptions by type, a year", parts: types.map((t3, i3) => ({ label: subTypeName(t3.type), value: t3.year, color: i3 + 1 })) }),
        /* @__PURE__ */ u3(Legend, { layout: "inline", items: types.map((t3, i3) => ({ label: subTypeName(t3.type), color: i3 + 1, value: whole(t3.year) })) })
      ] }),
      /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: subs.map(({ x: x2, month: month4, year, due }) => /* @__PURE__ */ u3(
        Row,
        {
          lead: /* @__PURE__ */ u3(PayMark, { x: x2 }),
          title: x2.name,
          sub: `${subTypeName(typeOf(x2))} · ${scheduleText(x2.schedule, L2)} · ${x2.schedule.every === "year" ? `${whole(month4)} a month` : `${whole(year)} a year`}`,
          end: /* @__PURE__ */ u3("span", { class: "fx-badge fx-due" + (due.tone ? " fx-" + due.tone : ""), children: due.text }),
          when: /* @__PURE__ */ u3(Amount, { value: x2.amount, form: "full" }),
          whenPlain: true,
          onOpen: edit ? () => edit("payment", x2.id) : void 0,
          openLabel: edit ? "edit" : void 0
        },
        x2.id
      )) })
    ] });
  }
  var soonDays = 7;
  function RenewingWidget({ v: v3, L: L2, edit, all }) {
    const due = (v3.plan.payments || []).filter((x2) => x2.kind === "subscriptions").map((x2) => ({ x: x2, due: dueOf(v3, x2.id) })).filter((s3) => s3.due.days >= 0 && s3.due.days <= soonDays).sort((a3, b2) => a3.due.days - b2.due.days || b2.x.amount - a3.x.amount);
    if (!due.length) return null;
    const total = due.reduce((t3, s3) => t3 + s3.x.amount, 0);
    return /* @__PURE__ */ u3(
      Widget,
      {
        title: "Renewing soon",
        kind: "fx-renewing",
        actions: all && /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: all, children: "See all" }),
        children: [
          /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: total, form: "full" }), caption: `${plural2(due.length, "subscription")} in the next ${soonDays} days` }),
          /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: due.map(({ x: x2, due: d3 }) => /* @__PURE__ */ u3(
            Row,
            {
              lead: /* @__PURE__ */ u3(PayMark, { x: x2 }),
              title: x2.name,
              sub: `${dayLong(v3.next[x2.id])} · ${subTypeName(typeOf(x2))}`,
              end: /* @__PURE__ */ u3("span", { class: "fx-badge fx-due" + (d3.tone ? " fx-" + d3.tone : ""), children: d3.text }),
              when: /* @__PURE__ */ u3(Amount, { value: x2.amount, form: "full" }),
              whenPlain: true,
              onOpen: edit ? () => edit("payment", x2.id) : void 0,
              openLabel: edit ? "edit" : void 0
            },
            x2.id
          )) })
        ]
      }
    );
  }

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
  var opening = "";
  var openOn = (filter) => {
    opening = filter;
  };
  function Recurring({ v: v3, L: L2, edit }) {
    const [filter, setFilter] = d2(() => {
      const f4 = opening || "all";
      opening = "";
      return f4;
    });
    const payments = allPayments(v3.plan);
    const next = nextOf(v3);
    const m3 = month(v3, L2);
    const share2 = (n2) => m3.in ? `${Math.round(n2 / m3.in * 100)}% of pay` : "";
    const onCard = (x2) => L2.account[x2.from || ""]?.kind === "card";
    const list = payments.filter((x2) => groups2[filter](x2.kind)).sort((a3, b2) => (next[a3.id]?.date || "9").localeCompare(next[b2.id]?.date || "9"));
    const count = (g2) => payments.filter((x2) => groups2[g2](x2.kind)).length;
    const paidLine = (x2) => {
      const pd = (v3.paid || []).filter((q2) => q2.payment === x2.id && daysBetween(q2.date, v3.today) <= 42).sort((a3, b2) => b2.date.localeCompare(a3.date))[0];
      if (!pd) return null;
      const off = pd.amount - pd.planned;
      return /* @__PURE__ */ u3("span", { class: "fx-kept fx-paidline", children: [
        "Paid ",
        dayShort(pd.date),
        pd.due !== pd.date ? `, for ${dayShort(pd.due)}` : "",
        Math.abs(off) >= 5e-3 && /* @__PURE__ */ u3(S, { children: [
          ": ",
          money(pd.amount),
          ", ",
          /* @__PURE__ */ u3("span", { class: off > 0 ? "fx-out" : "fx-in", children: off > 0 ? `${money(off)} more` : `${money(-off)} less` }),
          " than planned"
        ] })
      ] });
    };
    const kept = (x2, n2) => {
      const a3 = L2.account[x2.to || ""];
      if (!a3 || !saving(a3.kind)) return null;
      const after2 = n2?.period.accounts?.[a3.id];
      return /* @__PURE__ */ u3("span", { class: "fx-kept", children: [
        a3.name,
        ": ",
        money(todayOf(v3, a3)),
        " today",
        after2 !== void 0 && /* @__PURE__ */ u3(S, { children: [
          ", ",
          money(after2),
          " after ",
          dayShort(n2.period.last)
        ] })
      ] });
    };
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
          children: filter === "subscriptions" ? /* @__PURE__ */ u3(SubscriptionsSummary, { v: v3, L: L2, edit: edit ? (w3, id2) => edit(w3, id2) : void 0 }) : /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: [
            list.map((x2) => {
              const n2 = next[x2.id];
              const later2 = n2 ? "" : v3.next?.[x2.id] || "";
              const from = n2 && (x2.to && x2.to === v3.checking ? "into checking" : onCard(x2) ? "on " + L2.account[x2.from].name : n2.period.now ? "from the current balance" : `${n2.period.pay.people.map((id2) => L2.person[id2]?.name).join(" and ")}'s ${dayShort(n2.period.pay.date)} check`);
              const into2 = x2.to ? " → " + (L2.account[x2.to]?.name || x2.to) : "";
              return /* @__PURE__ */ u3(
                Row,
                {
                  lead: /* @__PURE__ */ u3(PayMark, { x: x2 }),
                  title: x2.name,
                  sub: /* @__PURE__ */ u3(S, { children: [
                    scheduleText(x2.schedule, L2) + into2 + (x2.card ? " · the card's balance" : x2.estimate ? " · about" : ""),
                    kept(x2, n2),
                    paidLine(x2)
                  ] }),
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
    const into2 = (id2) => {
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
                const parts2 = [{ label: "Take-home", value: e3.net, color: "in" }, ...ded.map((d3) => ({ label: d3.name, value: d3.amount, color: d3.account ? "save" : "track" })), ...e3.gross - e3.net - taken > 0.5 ? [{ label: "Taxes and the rest", value: e3.gross - e3.net - taken, color: "muted" }] : []];
                return /* @__PURE__ */ u3(S, { children: [
                  /* @__PURE__ */ u3(SplitBar, { size: "sm", label: `${e3.name}'s pay`, parts: parts2 }),
                  /* @__PURE__ */ u3(Legend, { layout: "inline", items: parts2.map((p3) => ({ label: p3.label, color: p3.color })) })
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
          sub: p3.people.map((id2) => L2.person[id2]?.name + (into2(id2) ? ` (into ${into2(id2)})` : "")).join(" and "),
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
      return x2 ? /* @__PURE__ */ u3(PayMark, { x: x2, size: "sm" }) : /* @__PURE__ */ u3(Dot, { color: e3.amount > 0 ? "in" : "out" });
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
  function CashFlowWidget({ v: v3, L: L2 }) {
    const m3 = month(v3, L2);
    return /* @__PURE__ */ u3(Widget, { title: "Cash flow", kind: "fx-flow", children: [
      /* @__PURE__ */ u3(Stat, { value: /* @__PURE__ */ u3(Amount, { value: m3.left, sign: true, tone: "auto" }), caption: "Left in a typical month" }),
      /* @__PURE__ */ u3(SplitBar, { label: "A typical month's pay", parts: [{ label: "Spent", value: m3.spent, color: "out" }, { label: "Saved", value: m3.saved, color: "save" }, { label: "Left", value: Math.max(0, m3.left), color: "in" }] }),
      /* @__PURE__ */ u3(Tiles2, { items: [
        { label: "Income", value: whole(m3.in), tone: "in" },
        { label: "Spending", value: whole(m3.spent), tone: "out" },
        { label: "Saved", value: m3.in ? `${Math.round((m3.saved + m3.viaPay) / (m3.in + m3.viaPay) * 100)}%` : whole(m3.saved), tone: "save" }
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
  var ownTile = ["checking", "savings", "investment", "retirement"];
  var names = (ids, L2) => ids.map((id2) => L2.person[id2]?.name || id2).join(" and ");
  var periodTitle = (p3, L2) => p3.now ? `Now · until ${dayLong(p3.last)}` : `${names(p3.pay.people, L2)}'s paycheck · ${dayLong(p3.pay.date)}`;
  function into(v3, L2, p3) {
    const out = {};
    const add = (id2, n2) => {
      if (id2 && id2 !== v3.checking) out[id2] = (out[id2] || 0) + n2;
    };
    for (const r3 of p3.rows) add(L2.payment[r3.payment]?.to, r3.amount);
    for (const d3 of v3.paydays || []) {
      if (d3.date < p3.start || d3.date > p3.last) continue;
      for (const id2 of d3.people) {
        const e3 = L2.person[id2];
        if (!e3) continue;
        add(e3.account, e3.net);
        for (const x2 of e3.deductions || []) add(x2.account, x2.amount);
      }
    }
    return out;
  }
  function tiles(v3, L2, i3) {
    const p3 = v3.periods[i3], before = v3.periods[i3 - 1];
    const went = into(v3, L2, p3);
    const at = (a3, q2) => q2 ? q2.accounts?.[a3.id] ?? todayOf(v3, a3) : todayOf(v3, a3);
    const accounts = v3.plan.accounts || [];
    const out = accounts.filter((a3) => ownTile.includes(a3.kind)).map((a3) => ({
      key: a3.id,
      name: a3.name,
      lead: /* @__PURE__ */ u3(AcctMark, { a: a3, size: "sm" }),
      after: at(a3, p3),
      was: at(a3, before),
      owes: false,
      in: went[a3.id] || 0
    }));
    const held2 = accounts.filter((a3) => a3.kind === "collectible");
    const heldTile = () => {
      const sum = (q2) => held2.reduce((t3, a3) => t3 + at(a3, q2), 0);
      return { key: "collectibles", name: "Collectibles", owes: false, after: sum(p3), was: sum(before), in: held2.reduce((t3, a3) => t3 + (went[a3.id] || 0), 0), lead: /* @__PURE__ */ u3(Mark2, { kind: "collectible", name: "Collectibles", size: "sm" }) };
    };
    const cards = accounts.filter((a3) => a3.kind === "card");
    if (cards.length) {
      const sum = (q2) => cards.reduce((t3, a3) => t3 + at(a3, q2), 0);
      out.push({
        key: "cards",
        name: cards.length === 1 ? cards[0].name : "Cards",
        owes: true,
        after: sum(p3),
        was: sum(before),
        in: cards.reduce((t3, a3) => t3 + (went[a3.id] || 0), 0) + p3.rows.filter((r3) => cards.some((a3) => L2.payment[r3.payment]?.card === a3.id)).reduce((t3, r3) => t3 + r3.amount, 0),
        lead: cards.length === 1 ? /* @__PURE__ */ u3(AcctMark, { a: cards[0], size: "sm" }) : /* @__PURE__ */ u3(Mark2, { kind: "card", name: "Cards", size: "sm" })
      });
    }
    if (held2.length) out.push(heldTile());
    return out;
  }
  function PaycheckWidget({ v: v3, L: L2, sel: sel2, pick, edit }) {
    const [all, setAll] = d2(false);
    const i3 = Math.min(sel2, v3.periods.length - 1);
    const p3 = v3.periods[i3];
    if (!p3) return null;
    const rows = all ? p3.rows : p3.rows.slice(0, shown3);
    const cushion = v3.plan.cushion || 0;
    const row = tiles(v3, L2, i3);
    return /* @__PURE__ */ u3(
      Widget,
      {
        title: periodTitle(p3, L2),
        kind: "fx-paycheck",
        span: "all",
        actions: /* @__PURE__ */ u3(S, { children: [
          /* @__PURE__ */ u3("button", { type: "button", class: "small", disabled: i3 === 0, onClick: () => pick(0), children: "Today" }),
          /* @__PURE__ */ u3(IconButton, { icon: "prev", label: "The pay period before", disabled: i3 === 0, onClick: () => pick(i3 - 1) }),
          /* @__PURE__ */ u3(IconButton, { icon: "next", label: "The pay period after", disabled: i3 >= v3.periods.length - 1, onClick: () => pick(i3 + 1) })
        ] }),
        children: [
          /* @__PURE__ */ u3("p", { class: "fx-sub fx-lead fx-dates", children: [
            dayShort(p3.start),
            " – ",
            dayShort(p3.last),
            p3.now ? ", from today" : ""
          ] }),
          !!row.length && /* @__PURE__ */ u3("ul", { class: "fx-acctrow", "aria-label": "Each account after this paycheck's bills", children: row.map((t3) => {
            const sign = t3.owes ? -1 : 1, d3 = (t3.after - t3.was) * sign;
            return /* @__PURE__ */ u3("li", { class: "fx-accttile" + (t3.in >= 5e-3 ? " fx-gets" : ""), children: [
              /* @__PURE__ */ u3("span", { class: "fx-acctname", children: [
                t3.lead,
                /* @__PURE__ */ u3("span", { children: t3.name })
              ] }),
              /* @__PURE__ */ u3(Amount, { value: t3.after * sign, form: "full" }),
              /* @__PURE__ */ u3("span", { class: "fx-acctnote", children: [
                Math.abs(d3) >= 5e-3 ? /* @__PURE__ */ u3("span", { class: d3 < 0 ? "fx-out" : "fx-in", children: signed(d3) }) : /* @__PURE__ */ u3("span", { class: "fx-sub", children: "No change" }),
                t3.in >= 5e-3 && /* @__PURE__ */ u3("span", { class: "fx-gotin", children: t3.owes ? `${compact(t3.in)} paid` : `${compact(t3.in)} in` })
              ] })
            ] }, t3.key);
          }) }),
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
            rows.map((r3, k3) => {
              const x2 = L2.payment[r3.payment];
              const src = L2.account[x2?.from];
              const via = r3.outside || r3.into ? (src?.kind === "card" ? "on " : "from ") + (src?.name || "another account") : kindName(x2?.kind || "other");
              return /* @__PURE__ */ u3(
                Row,
                {
                  lead: /* @__PURE__ */ u3(PayMark, { x: x2 }),
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
                k3
              );
            }),
            !p3.rows.length && /* @__PURE__ */ u3("li", { children: /* @__PURE__ */ u3(Empty, { children: "Nothing to pay before the next paycheck." }) })
          ] }),
          p3.rows.length > shown3 && /* @__PURE__ */ u3("p", { class: "actions fx-more", children: /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: () => setAll(!all), children: all ? "Show fewer" : `Show all ${p3.rows.length} payments` }) })
        ]
      }
    );
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
            lead: s3.person ? /* @__PURE__ */ u3(Who, { name: L2.person[s3.person]?.name, n: L2.order[s3.person] ?? 0 }) : /* @__PURE__ */ u3(PayMark, { x: x2 }),
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
  function PostPayWidget({ v: v3, L: L2, sel: sel2, pick, update }) {
    const accounts = (v3.plan.accounts || []).filter(shown4);
    const cols = v3.periods.slice(0, postCols);
    const today = (a3) => owed(a3.kind) ? -todayOf(v3, a3) : todayOf(v3, a3);
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
    if (!accounts.length) return null;
    return /* @__PURE__ */ u3(
      Widget,
      {
        span: "all",
        kind: "finpost",
        title: /* @__PURE__ */ u3(S, { children: [
          "Accounts, paycheck by paycheck ",
          /* @__PURE__ */ u3("span", { class: "fx-sub", children: "after the bills" })
        ] }),
        actions: update && /* @__PURE__ */ u3("button", { type: "button", class: "small", onClick: update, children: "Update balances" }),
        children: /* @__PURE__ */ u3("div", { class: "finpostscroll", children: /* @__PURE__ */ u3("table", { class: "finpost", children: [
          /* @__PURE__ */ u3("thead", { children: /* @__PURE__ */ u3("tr", { children: [
            /* @__PURE__ */ u3("th", { scope: "col", children: "Account" }),
            /* @__PURE__ */ u3("th", { scope: "col", class: "today", children: [
              /* @__PURE__ */ u3("span", { children: "Today" }),
              /* @__PURE__ */ u3("small", { children: dayShort(v3.today) })
            ] }),
            cols.map((p3, i3) => /* @__PURE__ */ u3("th", { scope: "col", class: i3 === sel2 ? "on" : "", children: /* @__PURE__ */ u3("button", { type: "button", "aria-pressed": i3 === sel2, onClick: () => pick(i3), children: head(p3) }) }, p3.start))
          ] }) }),
          /* @__PURE__ */ u3("tbody", { children: accounts.map((a3) => /* @__PURE__ */ u3("tr", { children: [
            /* @__PURE__ */ u3("th", { scope: "row", children: /* @__PURE__ */ u3("span", { class: "acct", children: [
              /* @__PURE__ */ u3(AcctMark, { a: a3, size: "sm" }),
              /* @__PURE__ */ u3("span", { children: [
                /* @__PURE__ */ u3("strong", { children: a3.name }),
                (a3.kind === "card" ? a3.pending ? `${money(a3.pending)} pending` : "" : a3.detail) && /* @__PURE__ */ u3("small", { children: a3.kind === "card" ? `${money(a3.pending)} pending` : a3.detail })
              ] })
            ] }) }),
            /* @__PURE__ */ u3("td", { class: "today", children: /* @__PURE__ */ u3("span", { class: "num", children: money(today(a3)) }) }),
            cols.map((p3, i3) => {
              const was = i3 ? at(a3, cols[i3 - 1]) : today(a3), now = at(a3, p3);
              return /* @__PURE__ */ u3("td", { class: i3 === sel2 ? "on" : "", children: [
                /* @__PURE__ */ u3("span", { class: "num" + (a3.id === v3.checking && p3.left < (v3.plan.cushion || 0) ? p3.left < 0 ? " bad" : " warn" : ""), children: money(now) }),
                change(now - was)
              ] }, p3.start);
            })
          ] }, a3.id)) }),
          /* @__PURE__ */ u3("tfoot", { children: /* @__PURE__ */ u3("tr", { children: [
            /* @__PURE__ */ u3("th", { scope: "row", children: "Total" }),
            /* @__PURE__ */ u3("td", { class: "today", children: /* @__PURE__ */ u3("span", { class: "num", children: money(total(today)) }) }),
            cols.map((p3, i3) => /* @__PURE__ */ u3("td", { class: i3 === sel2 ? "on" : "", children: /* @__PURE__ */ u3("span", { class: "num", children: money(total((a3) => at(a3, p3))) }) }, p3.start))
          ] }) })
        ] }) })
      }
    );
  }

  // web/src/finances/Overview.tsx
  function Overview({ v: v3, L: L2, sel: sel2, pick, add, edit, setWaiting: setWaiting2, openWorth, openSubscriptions, openTransactions }) {
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
        /* @__PURE__ */ u3(PaycheckWidget, { v: v3, L: L2, sel: picked, pick, edit }),
        /* @__PURE__ */ u3(CheckingWidget, { v: v3, L: L2, sel: picked }),
        /* @__PURE__ */ u3(RenewingWidget, { v: v3, L: L2, edit, all: openSubscriptions }),
        /* @__PURE__ */ u3(BudgetsWidget, { v: v3, only: toWatch, title: "Budgets to watch", span: 1, open: openTransactions }),
        /* @__PURE__ */ u3(CashFlowWidget, { v: v3, L: L2 }),
        /* @__PURE__ */ u3(SpendingWidget, { v: v3, L: L2 }),
        /* @__PURE__ */ u3(NetWorthWidget, { v: v3, open: openWorth })
      ] })
    ] });
  }

  // web/src/finances/Worth.tsx
  var ranges2 = [["3", "3 months", 3], ["6", "6 months", 6], ["12", "1 year", 12], ["all", "All", 600]];
  function ago2(day3, today) {
    if (!day3) return "not typed in yet";
    const n2 = daysBetween(day3, today);
    return n2 <= 0 ? "updated today" : n2 === 1 ? "updated yesterday" : n2 < 14 ? `updated ${n2} days ago` : `updated ${dayShort(day3)}`;
  }
  var month2 = (day3) => monthName(day3).slice(0, 3);
  function NetWorth({ v: v3, L: L2, edit, sel: sel2, pick, update }) {
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
    const back = Math.max(1, Math.min(ranges2.find(([k3]) => k3 === range)?.[2] ?? 3, (today.getFullYear() - kept.getFullYear()) * 12 + today.getMonth() - kept.getMonth()));
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
    const named5 = (g2) => netted && g2.key === "property" ? `${g2.name}, less their loans` : g2.name;
    const bars = (m3) => {
      const equity = (m3.owned.property || 0) - m3.secured;
      const up = keys2.map((g2) => ({ key: g2.key, value: g2.key === "property" ? Math.max(equity, 0) : m3.owned[g2.key] || 0, color: g2.color }));
      return { up, down: m3.owes - m3.secured + (homeToo ? Math.max(-equity, 0) : 0), net: homeToo ? m3.net : m3.net - equity };
    };
    const owedName = netted ? "Other debts" : "Owed";
    const netName = homeToo ? "Net worth" : "Net worth without Home & Car";
    const sorted = (list) => [...list].sort((a3, b2) => Math.abs(worthOf(v3, b2)) - Math.abs(worthOf(v3, a3)));
    const row = (a3) => {
      const w3 = worthOf(v3, a3), d3 = w3 - worthOn(v3, a3, start.date);
      const loan = a3.loan ? accounts.find((x2) => x2.id === a3.loan) : void 0;
      const paid = a3.original ? Math.max(0, Math.min(1, (a3.original - a3.balance) / a3.original)) : -1;
      const sub = loan ? `${money(todayOf(v3, a3) - todayOf(v3, loan))} equity` : paid >= 0 ? `${Math.round(paid * 100)}% of ${whole(a3.original)} paid` : a3.kind === "card" && a3.pending ? `${money(a3.pending)} pending` : ago2(a3.updated, v3.today);
      return /* @__PURE__ */ u3(
        Row,
        {
          lead: /* @__PURE__ */ u3(AcctMark, { a: a3 }),
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
            hasHome && /* @__PURE__ */ u3(Segmented, { label: "What it counts", value: counted, pick: setCounted, options: [["all", "Everything"], ["liquid", "Without Home & Car"]] }),
            /* @__PURE__ */ u3(Segmented, { label: "How far back", value: range, pick: setRange, options: ranges2.map(([k3, t3]) => [k3, t3]) })
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
                      /* @__PURE__ */ u3("span", { children: named5(g2) }),
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
              ...keys2.map((g2) => ({ label: named5(g2), color: g2.color })),
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
      ] }), kind: "fx-owelist", children: debts.length ? /* @__PURE__ */ u3(Rows, { kind: "fx-rows", children: sorted(debts).map(row) }) : /* @__PURE__ */ u3(Empty, { children: "Nothing owed." }) }),
      /* @__PURE__ */ u3(PostPayWidget, { v: v3, L: L2, sel: Math.min(sel2, v3.periods.length - 1), pick, update })
    ] }) });
  }

  // web/src/finances/Finances.tsx
  var tabs = [["overview", "Dashboard"], ["calendar", "Calendar"], ["transactions", "Transactions"], ["reports", "Reports"], ["recurring", "Recurring"], ["pay", "Pay"], ["worth", "Net worth"]];
  var adds = { overview: ["payment", "Add a payment"], calendar: ["payment", "Add a payment"], transactions: ["transaction", "Add a transaction"], reports: ["transaction", "Add a transaction"], recurring: ["payment", "Add a payment"], pay: ["person", "Add a paycheck"], worth: ["account", "Add an account"] };
  function FinancesScreen({ v: v3, ledger, error, retry, tab: tab2, setTab, sel: sel2, pick, setWaiting: setWaiting2, saveSettings, edit: open2, phone: phone2 }) {
    const edit = (what2, id2, kind) => cardOf(id2) ? open2("account", cardOf(id2)) : open2(what2, id2, kind);
    const L2 = v3 ? lookup(v3.plan) : null;
    setCurrency(v3?.plan.currency);
    setOwnLogos(v3?.plan.logos);
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
        !ro && /* @__PURE__ */ u3("div", { class: "toolbar", children: [
          !!v3?.plan.accounts?.length && /* @__PURE__ */ u3("button", { class: "btn", onClick: () => edit("balances"), children: "Update balances" }),
          /* @__PURE__ */ u3("button", { class: "btn fx-primary", onClick: () => edit(what), disabled: !v3, children: [
            /* @__PURE__ */ u3("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ u3("path", { d: "M12 5v14M5 12h14" }) }),
            label
          ] })
        ] })
      ] }),
      /* @__PURE__ */ u3(Segmented, { label: "View", value: tab2, pick: setTab, options: tabs }),
      /* @__PURE__ */ u3("div", { class: "finbody", children: !v3 && error ? /* @__PURE__ */ u3(Empty, { children: [
        "The finances file could not be read: ",
        error,
        " ",
        /* @__PURE__ */ u3("button", { class: "small", onClick: retry, children: "Try again" })
      ] }) : !v3 ? /* @__PURE__ */ u3(Empty, { children: "Reading…" }) : ro ? /* @__PURE__ */ u3(View, { v: v3, L: L2, ledger, tab: tab2, sel: sel2, pick, openWorth: () => setTab("worth"), openSubscriptions: () => {
        openOn("subscriptions");
        setTab("recurring");
      }, openTransactions: () => setTab("transactions") }) : tab2 === "calendar" ? /* @__PURE__ */ u3(Calendar, { v: v3, L: L2, edit: (w3, id2) => edit(w3, id2) }) : tab2 === "transactions" ? /* @__PURE__ */ u3(Transactions, { v: v3, L: L2, ledger, edit: (w3, id2) => edit(w3, id2) }) : tab2 === "reports" ? /* @__PURE__ */ u3(Reports, { v: v3, ledger }) : tab2 === "recurring" ? /* @__PURE__ */ u3(Recurring, { v: v3, L: L2, edit }) : tab2 === "pay" ? /* @__PURE__ */ u3(Pay, { v: v3, L: L2, edit, saveSettings }) : tab2 === "worth" ? /* @__PURE__ */ u3(NetWorth, { v: v3, L: L2, edit, sel: sel2, pick, update: () => edit("balances") }) : /* @__PURE__ */ u3(Overview, { v: v3, L: L2, sel: sel2, pick, setWaiting: setWaiting2, add: (w3, k3) => edit(w3, void 0, k3), edit: (w3, id2) => edit(w3, id2), openWorth: () => setTab("worth"), openSubscriptions: () => {
        openOn("subscriptions");
        setTab("recurring");
      }, openTransactions: () => setTab("transactions") }) })
    ] });
  }
  function View({ v: v3, L: L2, ledger, tab: tab2, sel: sel2, pick, openWorth, openSubscriptions, openTransactions }) {
    return tab2 === "calendar" ? /* @__PURE__ */ u3(Calendar, { v: v3, L: L2 }) : tab2 === "transactions" ? /* @__PURE__ */ u3(Transactions, { v: v3, L: L2, ledger }) : tab2 === "reports" ? /* @__PURE__ */ u3(Reports, { v: v3, ledger }) : tab2 === "recurring" ? /* @__PURE__ */ u3(Recurring, { v: v3, L: L2 }) : tab2 === "pay" ? /* @__PURE__ */ u3(Pay, { v: v3, L: L2 }) : tab2 === "worth" ? /* @__PURE__ */ u3(NetWorth, { v: v3, L: L2, sel: sel2, pick }) : /* @__PURE__ */ u3(Overview, { v: v3, L: L2, sel: sel2, pick, openWorth, openSubscriptions, openTransactions });
  }
  function mountFinances(el, props) {
    R(/* @__PURE__ */ u3(FinancesScreen, { ...props }), el);
  }

  // web/src/screens/finances.ts
  var financesData = store(() => go().Finances());
  financesData.watch(draw3);
  var ledgerData = store(() => go().FinancesLedger());
  ledgerData.watch(draw3);
  function loadFinances() {
    return Promise.all([financesData.load(), ledgerData.load()]).then(() => {
    });
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
      ledger: ledgerData.value || null,
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
      edit: open,
      setWaiting,
      saveSettings: (s3) => save({ ...financesData.value.plan, currency: s3.currency, holidays: s3.holidays }),
      phone
    });
    if (editing && v3 && !v3.readOnly) mountFinanceSheet($2("finSheetBox"), { ...editing, plan: v3.plan, checking: v3.checking, start: v3.start, categories: v3.categories, ledger: ledgerData.value, save, saveLedger, close: close2 });
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
  async function saveLedger(l3) {
    try {
      ledgerData.set(await go().SaveFinancesLedger(l3));
      financesData.load();
      return true;
    } catch (e3) {
      showError(e3);
      ledgerData.load();
      return false;
    }
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
    mountFinanceSheet($2("finSheetBox"), { ...editing, plan: v3.plan, checking: v3.checking, start: v3.start, categories: v3.categories, ledger: ledgerData.value, save, saveLedger, close: close2 });
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
    if (name === "finances") {
      financesData.fresh(minute);
      ledgerData.fresh(minute);
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
    const last = Promise.resolve().then(() => go().LastStatus()).catch(() => null);
    try {
      const info = await loadHost();
      if (!info.rootOK) return show("setup");
      await loadCatalog();
      await drawRemembered(last);
      const steps = onPhone() ? null : stepsData.load();
      if (document.documentElement.classList.contains("kiosk")) return show("status");
      const screen = await go().Screen();
      if (screen) return screen.startsWith("app:") ? openApp(screen.slice(4)) : navigate(screen);
      if (!steps) return show("status");
      await steps;
      if (stepsData.error) throw stepsData.error;
      if (progress(stepsData.value).left && !navigated) show("setup");
    } catch (e3) {
      showError(e3);
      show("setup");
    }
  });
})();
/*! Finances' logos: simple-icons (simpleicons.org), CC0. The marks are
 * their owners' trademarks, shown only beside the account or payment they
 * name. */
