"use client";

import { useState } from "react";
import { Button } from "./ui/button";

export default function WatchlistButton({
  symbol,
  company,
  isInWatchlist,
  showTrashIcon = false,
  type = "button",
  onWatchlistChange,
}: WatchlistButtonProps) {
  const [inWatchlist, setInWatchlist] = useState(isInWatchlist);

  const handleToggle = () => {
    const newStatus = !inWatchlist;
    setInWatchlist(newStatus);
    onWatchlistChange?.(symbol, newStatus);
  };

  return (
    <Button
      onClick={handleToggle}
      className="w-full yellow-btn rounded-md transition-colors"
    >
      {inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
    </Button>
  );
}
