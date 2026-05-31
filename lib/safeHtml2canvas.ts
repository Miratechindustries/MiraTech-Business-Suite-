import html2canvas from "html2canvas";

function convertOklchToRgb(oklchStr: string): string {
  try {
    // Find all oklch(...) patterns (case insensitive) and substitute each with rgb / rgba equivalents
    return oklchStr.replace(/oklch\(([^)]+)\)/gi, (match, p1) => {
      try {
        const clean = p1.trim();
        // Split by spaces, or slashes, or commas
        const parts = clean.split(/[\s/,]+/).filter(Boolean);
        if (parts.length < 3) return "rgb(255, 255, 255)";

        let l = parseFloat(parts[0]);
        if (parts[0].includes("%")) {
          l = l / 100;
        }
        const c = parseFloat(parts[1]);
        const h = parseFloat(parts[2]);
        const a = parts[3] ? parseFloat(parts[3]) : 1;

        // Convert oklch to linear sRGB
        const hRad = (h * Math.PI) / 180;
        const a_oklab = c * Math.cos(hRad);
        const b_oklab = c * Math.sin(hRad);

        const l_lms = l + 0.3963377774 * a_oklab + 0.2158037573 * b_oklab;
        const m_lms = l - 0.1055613458 * a_oklab - 0.0638541728 * b_oklab;
        const s_lms = l - 0.0894841775 * a_oklab - 1.2914855480 * b_oklab;

        const l_cube = l_lms * l_lms * l_lms;
        const m_cube = m_lms * m_lms * m_lms;
        const s_cube = s_lms * s_lms * s_lms;

        const r_lin = +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
        const g_lin = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
        const b_lin = -0.0041960863 * l_cube - 0.7034186145 * m_cube + 1.7076147010 * s_cube;

        const toSRGB = (val: number) => {
          if (val <= 0.0031308) {
            return Math.max(0, Math.min(255, Math.round(12.92 * val * 255)));
          }
          return Math.max(0, Math.min(255, Math.round((1.055 * Math.pow(val, 1 / 2.4) - 0.055) * 255)));
        };

        const r = toSRGB(r_lin);
        const g = toSRGB(g_lin);
        const b = toSRGB(b_lin);

        if (a < 1) {
          return `rgba(${r}, ${g}, ${b}, ${a})`;
        }
        return `rgb(${r}, ${g}, ${b})`;
      } catch (err) {
        console.error("Failed to parse individual oklch color:", match, err);
        return "rgb(255, 255, 255)";
      }
    });
  } catch (err) {
    console.error("Failed to convert oklch to rgb:", oklchStr, err);
    return "rgb(255, 255, 255)";
  }
}

/**
 * A safe wrapper around html2canvas to prevent parsing crashes on modern CSS rules containing "oklch"
 * which are common in Tailwind v4 but not yet supported by html2canvas's own CSS parser.
 */
export default async function safeHtml2Canvas(element: HTMLElement, options: any = {}): Promise<HTMLCanvasElement> {
  if (typeof window === "undefined") {
    return html2canvas(element, options);
  }

  // Intercept cssRules AND rules to hide "oklch" (and any case variations) from html2canvas
  const originalDescriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "cssRules");
  const originalRulesDescriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "rules");
  const originalGroupingDescriptor = typeof CSSGroupingRule !== "undefined"
    ? Object.getOwnPropertyDescriptor(CSSGroupingRule.prototype, "cssRules")
    : null;
  const originalMediaDescriptor = typeof CSSMediaRule !== "undefined"
    ? Object.getOwnPropertyDescriptor(CSSMediaRule.prototype, "cssRules")
    : null;

  let interceptActive = true;

  const sanitizeRules = (rules: any) => {
    if (!rules) return rules;
    const filtered: CSSRule[] = [];
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule && rule.cssText && /oklch/i.test(rule.cssText)) {
        // If it's a style rule, we let it through if we can convert its cssText dynamically,
        // but if we are not converting cssText globally or if it's an unsupported block, we filter it.
        // To be absolutely safe, we will rewrite cssText via the CSSRule.prototype interceptor.
      }
      filtered.push(rule);
    }
    const mockRules = Object.create(rules);
    mockRules.length = filtered.length;
    filtered.forEach((rule, idx) => {
      mockRules[idx] = rule;
    });
    return mockRules;
  };

  if (originalDescriptor && originalDescriptor.get) {
    try {
      Object.defineProperty(CSSStyleSheet.prototype, "cssRules", {
        get() {
          try {
            const rules = originalDescriptor.get!.call(this);
            if (!rules || !interceptActive) return rules;
            return sanitizeRules(rules);
          } catch (e) {
            return null;
          }
        },
        configurable: true
      });
    } catch (e) {
      console.warn("[safeHtml2Canvas] Failed to intercept cssRules prototype:", e);
    }
  }

  if (originalRulesDescriptor && originalRulesDescriptor.get) {
    try {
      Object.defineProperty(CSSStyleSheet.prototype, "rules", {
        get() {
          try {
            const rules = originalRulesDescriptor.get!.call(this);
            if (!rules || !interceptActive) return rules;
            return sanitizeRules(rules);
          } catch (e) {
            return null;
          }
        },
        configurable: true
      });
    } catch (e) {
      // Ignored if rules does not exist
    }
  }

  if (originalGroupingDescriptor && originalGroupingDescriptor.get) {
    try {
      Object.defineProperty(CSSGroupingRule.prototype, "cssRules", {
        get() {
          try {
            const rules = originalGroupingDescriptor.get!.call(this);
            if (!rules || !interceptActive) return rules;
            return sanitizeRules(rules);
          } catch (e) {
            return null;
          }
        },
        configurable: true
      });
    } catch (e) {
      // Ignored
    }
  }

  if (originalMediaDescriptor && originalMediaDescriptor.get) {
    try {
      Object.defineProperty(CSSMediaRule.prototype, "cssRules", {
        get() {
          try {
            const rules = originalMediaDescriptor.get!.call(this);
            if (!rules || !interceptActive) return rules;
            return sanitizeRules(rules);
          } catch (e) {
            return null;
          }
        },
        configurable: true
      });
    } catch (e) {
      // Ignored
    }
  }

  // Intercept CSSRule.prototype.cssText dynamically to convert oklch to rgb/rgba
  const originalRuleCssTextDescriptor = Object.getOwnPropertyDescriptor(CSSRule.prototype, "cssText");
  if (originalRuleCssTextDescriptor && originalRuleCssTextDescriptor.get) {
    try {
      Object.defineProperty(CSSRule.prototype, "cssText", {
        get() {
          const val = originalRuleCssTextDescriptor.get!.call(this);
          if (typeof val === "string" && /oklch/i.test(val)) {
            return convertOklchToRgb(val);
          }
          return val;
        },
        configurable: true
      });
    } catch (e) {
      // Ignored
    }
  }

  // Intercept CSSStyleDeclaration.prototype.cssText dynamically to convert oklch to rgb/rgba
  const originalDeclCssTextDescriptor = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, "cssText");
  if (originalDeclCssTextDescriptor && originalDeclCssTextDescriptor.get) {
    try {
      Object.defineProperty(CSSStyleDeclaration.prototype, "cssText", {
        get() {
          const val = originalDeclCssTextDescriptor.get!.call(this);
          if (typeof val === "string" && /oklch/i.test(val)) {
            return convertOklchToRgb(val);
          }
          return val;
        },
        configurable: true
      });
    } catch (e) {
      // Ignored
    }
  }

  // Intercept CSSStyleDeclaration.prototype.getPropertyValue dynamically
  const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
  try {
    CSSStyleDeclaration.prototype.getPropertyValue = function (property: string): string {
      const val = originalGetPropertyValue.call(this, property);
      if (typeof val === "string" && /oklch/i.test(val)) {
        return convertOklchToRgb(val);
      }
      return val;
    };
  } catch (e) {
    console.warn("[safeHtml2Canvas] Failed to intercept getPropertyValue prototype:", e);
  }

  // Intercept window.getComputedStyle to dynamically replace oklch computed colors with rgb/rgba equivalents
  const originalGetComputedStyle = window.getComputedStyle;
  try {
    window.getComputedStyle = function (el: Element, pseudoElt?: string | null): CSSStyleDeclaration {
      const style = originalGetComputedStyle.call(this, el, pseudoElt);
      return new Proxy(style, {
        get(target: any, prop: string | symbol) {
          const val = target[prop];
          if (typeof prop === "string" && typeof val === "string" && /oklch/i.test(val)) {
            return convertOklchToRgb(val);
          }
          if (typeof val === "function") {
            return function (...args: any[]) {
              const res = val.apply(target, args);
              if (typeof res === "string" && /oklch/i.test(res)) {
                return convertOklchToRgb(res);
              }
              return res;
            };
          }
          return val;
        }
      });
    };

    const canvas = await html2canvas(element, options);
    return canvas;
  } finally {
    interceptActive = false;
    window.getComputedStyle = originalGetComputedStyle;
    CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
    if (originalDescriptor) {
      try {
        Object.defineProperty(CSSStyleSheet.prototype, "cssRules", originalDescriptor);
      } catch (e) {
        console.warn("[safeHtml2Canvas] Failed to restore cssRules prototype:", e);
      }
    }
    if (originalRulesDescriptor) {
      try {
        Object.defineProperty(CSSStyleSheet.prototype, "rules", originalRulesDescriptor);
      } catch (e) {
        // Ignored
      }
    }
    if (originalGroupingDescriptor) {
      try {
        Object.defineProperty(CSSGroupingRule.prototype, "cssRules", originalGroupingDescriptor);
      } catch (e) {
        // Ignored
      }
    }
    if (originalMediaDescriptor) {
      try {
        Object.defineProperty(CSSMediaRule.prototype, "cssRules", originalMediaDescriptor);
      } catch (e) {
        // Ignored
      }
    }
    if (originalRuleCssTextDescriptor) {
      try {
        Object.defineProperty(CSSRule.prototype, "cssText", originalRuleCssTextDescriptor);
      } catch (e) {
        // Ignored
      }
    }
    if (originalDeclCssTextDescriptor) {
      try {
        Object.defineProperty(CSSStyleDeclaration.prototype, "cssText", originalDeclCssTextDescriptor);
      } catch (e) {
        // Ignored
      }
    }
  }
}
