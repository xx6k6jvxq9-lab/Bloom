import React from 'react';

export type SongBoardItem = {
  sourceLabel: string;
  title: string;
  artist: string;
  lyricLines: string[];
  progressPercent: number;
  durationLabel: string;
};

type GroupOfflineSongBoardProps = {
  item: SongBoardItem;
};

export function GroupOfflineSongBoard({ item }: GroupOfflineSongBoardProps) {
  return (
    <div className="group-offline-scene__song-line">
      <div className="group-offline-scene__song-board">
        <div className="group-offline-scene__song-board-player">
          {item.lyricLines.length > 0 ? (
            <div className="group-offline-scene__song-board-lyrics">
              {item.lyricLines.map((line, index) => (
                <div key={`${item.title}-lyric-${index}`} className="group-offline-scene__song-board-lyric-line">
                  {line}
                </div>
              ))}
            </div>
          ) : null}
          <div className="group-offline-scene__song-board-title">{item.title}</div>
          <div className="group-offline-scene__song-board-artist">{item.artist}</div>
          <div className="group-offline-scene__song-board-progress" aria-hidden="true">
            <span className="group-offline-scene__song-board-progress-line">
              <span
                className="group-offline-scene__song-board-progress-dot"
                style={{ left: `${item.progressPercent}%` }}
              />
            </span>
            <span className="group-offline-scene__song-board-duration">{item.durationLabel}</span>
          </div>
          <div className="group-offline-scene__song-board-controls" aria-hidden="true">
            <span className="group-offline-scene__song-board-control">↔</span>
            <span className="group-offline-scene__song-board-control">◁</span>
            <span className="group-offline-scene__song-board-control group-offline-scene__song-board-control--pause">❚❚</span>
            <span className="group-offline-scene__song-board-control">▷</span>
            <span className="group-offline-scene__song-board-control">↻</span>
          </div>
        </div>
      </div>
    </div>
  );
}
