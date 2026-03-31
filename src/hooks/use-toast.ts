"use client";

import { useState, useCallback } from "react";

interface Toast {
  id:          string;
  title?:      string;
  description?: string;
  variant?:    "default" | "destructive";
}

type ToastState = Toast[];

let listeners: Array<(toasts: ToastState) => void> = [];
let toasts: ToastState = [];

function dispatch(newToasts: ToastState) {
  toasts = newToasts;
  listeners.forEach((l) => l(newToasts));
}

export function toast(props: Omit<Toast, "id">) {
  const id = Math.random().toString(36).slice(2);
  dispatch([...toasts, { id, ...props }]);
  setTimeout(() => {
    dispatch(toasts.filter((t) => t.id !== id));
  }, 4000);
  return id;
}

export function useToast() {
  const [state, setState] = useState<ToastState>(toasts);

  useState(() => {
    listeners.push(setState);
    return () => {
      listeners = listeners.filter((l) => l !== setState);
    };
  });

  const dismiss = useCallback((id: string) => {
    dispatch(toasts.filter((t) => t.id !== id));
  }, []);

  return { toasts: state, toast, dismiss };
}
