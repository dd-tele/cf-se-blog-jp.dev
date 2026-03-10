import { useRef, useEffect, useState, type RefObject, type ReactNode } from "react";

type RevealDirection = "up" | "down" | "left" | "right" | "none";

interface ScrollRevealProps {
  children: ReactNode;
  direction?: RevealDirection;
  delay?: number;
  duration?: number;
  distance?: number;
  threshold?: number;
  once?: boolean;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

const directionTransform: Record<RevealDirection, (d: number) => string> = {
  up: (d) => `translateY(${d}px)`,
  down: (d) => `translateY(-${d}px)`,
  left: (d) => `translateX(${d}px)`,
  right: (d) => `translateX(-${d}px)`,
  none: () => "translate(0, 0)",
};

export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 700,
  distance = 40,
  threshold = 0.15,
  once = true,
  className = "",
  as: Tag = "div",
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  const hiddenTransform = directionTransform[direction](distance);

  const style: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "translate(0, 0)" : hiddenTransform,
    transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
    willChange: "opacity, transform",
  };

  return (
    // @ts-expect-error dynamic tag
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
}

interface StaggerChildrenProps {
  children: ReactNode[];
  direction?: RevealDirection;
  staggerDelay?: number;
  baseDelay?: number;
  duration?: number;
  distance?: number;
  threshold?: number;
  className?: string;
  childClassName?: string;
}

/**
 * Auto-reveal hook: attach to a container and all direct <section> children
 * below the initial viewport will fade-in + slide-up on scroll.
 * Above-fold sections are left untouched (no SSR flash, no fixed-modal issues).
 */
export function useAutoReveal(
  containerRef: RefObject<HTMLElement | null>,
  options?: {
    selector?: string;
    distance?: number;
    duration?: number;
    threshold?: number;
  },
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const selector = options?.selector ?? ":scope > section";
    const distance = options?.distance ?? 48;
    const duration = options?.duration ?? 700;
    const threshold = options?.threshold ?? 0.12;
    const easing = "cubic-bezier(0.16, 1, 0.3, 1)";

    const sections = container.querySelectorAll(selector);
    const toAnimate: HTMLElement[] = [];

    sections.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.dataset.noReveal !== undefined) return;

      const rect = htmlEl.getBoundingClientRect();
      // Leave above-fold elements visible — only animate those below the viewport
      if (rect.top < window.innerHeight) return;

      htmlEl.style.opacity = "0";
      htmlEl.style.transform = `translateY(${distance}px)`;
      toAnimate.push(htmlEl);
    });

    if (toAnimate.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.style.transition = `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}`;
            // RAF ensures the browser has painted the hidden state first
            requestAnimationFrame(() => {
              el.style.opacity = "1";
              el.style.transform = "translateY(0)";
            });
            observer.unobserve(el);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -60px 0px" },
    );

    toAnimate.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}

/**
 * Full-page scroll: intercept wheel / keyboard and scroll exactly one
 * snap-start section at a time with a custom JS animation duration.
 * CSS snap is kept for touch / fallback but temporarily disabled during
 * the JS animation to avoid fighting.
 */
export function useFullPageScroll(
  containerRef: RefObject<HTMLElement | null>,
  options?: { duration?: number; headerOffset?: number },
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dur = options?.duration ?? 1200;
    const hOff = options?.headerOffset ?? 0;
    let isAnimating = false;
    let accumulator = 0;
    let accTimer: ReturnType<typeof setTimeout> | null = null;
    const THRESHOLD = 50;

    const targets = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(".snap-start"));

    const scrollTopOf = (el: HTMLElement): number => {
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      return eRect.top - cRect.top + container.scrollTop - hOff;
    };

    const currentIdx = (ts: HTMLElement[]): number => {
      const st = container.scrollTop + hOff + 2;
      for (let i = ts.length - 1; i >= 0; i--) {
        if (scrollTopOf(ts[i]) + hOff <= st) return i;
      }
      return 0;
    };

    const animateTo = (targetY: number) => {
      const startY = container.scrollTop;
      const diff = targetY - startY;
      if (Math.abs(diff) < 2) return;

      isAnimating = true;
      const origSnap = container.style.scrollSnapType;
      container.style.scrollSnapType = "none";

      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min((now - t0) / dur, 1);
        // ease-in-out cubic
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        container.scrollTop = startY + diff * e;
        if (p < 1) {
          requestAnimationFrame(step);
        } else {
          container.scrollTop = targetY;
          container.style.scrollSnapType = origSnap;
          setTimeout(() => {
            isAnimating = false;
          }, 120);
        }
      };
      requestAnimationFrame(step);
    };

    const go = (dir: 1 | -1) => {
      if (isAnimating) return;
      const ts = targets();
      if (!ts.length) return;
      const ci = currentIdx(ts);
      const vh = container.clientHeight;

      const margin = vh * 0.15; // tolerance – jump instead of tiny scroll

      if (dir === 1) {
        // Where does the next pair start (or end of scrollable area)?
        const nextTop =
          ci + 1 < ts.length
            ? scrollTopOf(ts[ci + 1])
            : container.scrollHeight;
        const viewBottom = container.scrollTop + vh;
        const hiddenBelow = nextTop - viewBottom;

        // Significant content hidden below → scroll within pair
        if (hiddenBelow > margin) {
          // Advance by one viewport but never past next pair boundary
          const target = Math.min(
            container.scrollTop + vh - hOff,
            nextTop - vh,
          );
          // Guard: if target barely moves, just jump to next pair
          if (target - container.scrollTop < 2) {
            if (ci + 1 < ts.length) animateTo(scrollTopOf(ts[ci + 1]));
            return;
          }
          animateTo(target);
          return;
        }
        // Jump to next pair
        if (ci + 1 < ts.length) {
          animateTo(scrollTopOf(ts[ci + 1]));
        }
      } else {
        // Scrolling up — if not at the top of current pair, go there first
        const pairTop = scrollTopOf(ts[ci]);
        if (container.scrollTop - pairTop > margin) {
          animateTo(pairTop);
          return;
        }
        // Jump to previous pair
        if (ci > 0) {
          animateTo(scrollTopOf(ts[ci - 1]));
        }
      }
    };

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      if (isAnimating) return;
      accumulator += ev.deltaY;
      if (accTimer) clearTimeout(accTimer);
      accTimer = setTimeout(() => {
        accumulator = 0;
      }, 200);
      if (Math.abs(accumulator) >= THRESHOLD) {
        const d = accumulator > 0 ? 1 : -1;
        accumulator = 0;
        go(d as 1 | -1);
      }
    };

    const onKey = (ev: KeyboardEvent) => {
      if (isAnimating) return;
      if (["ArrowDown", "PageDown", " "].includes(ev.key)) {
        ev.preventDefault();
        go(1);
      } else if (["ArrowUp", "PageUp"].includes(ev.key)) {
        ev.preventDefault();
        go(-1);
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKey);
    return () => {
      container.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKey);
      if (accTimer) clearTimeout(accTimer);
    };
  }, []);
}

export function StaggerChildren({
  children,
  direction = "up",
  staggerDelay = 100,
  baseDelay = 0,
  duration = 600,
  distance = 30,
  threshold = 0.1,
  className = "",
  childClassName = "",
}: StaggerChildrenProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <ScrollReveal
          key={i}
          direction={direction}
          delay={baseDelay + i * staggerDelay}
          duration={duration}
          distance={distance}
          threshold={threshold}
          className={childClassName}
        >
          {child}
        </ScrollReveal>
      ))}
    </div>
  );
}
