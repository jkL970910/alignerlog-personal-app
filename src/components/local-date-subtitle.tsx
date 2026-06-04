"use client";

import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useEffect, useState } from "react";

export function LocalDateSubtitle() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    setLabel(format(new Date(), "M月d日 EEEE", { locale: zhCN }));
  }, []);

  return label ? <>{label}</> : null;
}
