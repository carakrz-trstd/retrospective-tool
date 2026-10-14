// All user-facing English texts live here (NFR-7).
export const texts = {
  appName: 'Retrospective Tool',
  internalNotice: 'Internal use only. Please do not share this tool or its links outside your company.',

  // home
  homeIntro: 'Run your team retrospective yourselves, even when your coach is away.',
  createSession: 'Create session',
  joinHeading: 'Join a session',
  joinCodeLabel: 'Join code or link',
  joinButton: 'Join',
  resumeHeading: 'Sessions on this device',
  resumeSession: 'Resume session',
  rejoinSession: 'Rejoin session',
  deleteSession: 'Remove from this device',
  storageUnavailable:
    'This browser does not allow saving data. The tool still works, but a session cannot be resumed after you close this page.',

  // forms
  nameLabel: 'Your name',
  roleLabel: 'Your role',
  titleLabel: 'Session title (optional)',
  titleHelp: 'For example the team or project name. It is used in the documentation.',
  nameRequired: 'Please enter your name.',
  roleRequired: 'Please enter your role.',
  forgetMe: 'Forget me',
  forgetMeHelp: 'Name and role are remembered on this device only.',
  formatNote:
    'Format: Start, Stop, Continue (50 minutes). More formats and a recommendation follow in a later version.',
  createButton: 'Create session',
  creating: 'Creating the session…',
  joining: 'Joining the session…',
  joiningViaLink: 'You are joining through an invitation link.',
  cancel: 'Cancel',
  back: 'Back',

  // errors
  sessionNotFound:
    'This session cannot be found. Check the code or link, or ask the Facilitator whether the session is still open.',
  sessionEnded: 'This session has already ended.',
  versionMismatch: 'Please reload the page to update the tool.',
  unavailable: 'The connection service cannot be reached. Please check your network and try again.',

  // lobby
  lobbyHeading: 'Lobby',
  shareHeading: 'Invite your team',
  joinLink: 'Join link',
  joinCode: 'Join code',
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed. Please select the text and copy it yourself.',
  participantsHeading: 'Participants',
  facilitatorBadge: 'Facilitator',
  you: 'you',
  online: 'online',
  offline: 'offline',
  startSession: 'Start session',
  waitingForStart: 'Waiting for the Facilitator to start the session…',
  tooManyWarning:
    'More than 8 people have joined. The tool is designed for teams of up to 8, but nobody is turned away.',
  removeParticipant: 'Remove',
  removeTitle: 'Remove participant',
  removeConfirm: (name: string) =>
    `Remove ${name} from the session? They cannot come back with the same device.`,
  removeAction: 'Remove from session',

  // session
  sessionHeading: 'Session',
  sessionPlaceholder: 'The session is running. The steps of the retrospective follow in the next version.',
  endSession: 'End session',
  endTitle: 'End the session for everyone?',
  endConfirm: 'End session',
  endAnyway: 'End session anyway',
  leaveSession: 'Leave session',

  // connection banner
  connecting: 'Connecting…',
  reconnecting: 'Connection lost. Reconnecting…',
  facilitatorOffline:
    'The Facilitator is offline. Your work is kept on this device and sent when they are back.',
  longOfflineHint:
    'The Facilitator has been offline for a while. Copy anything you wrote so far if you want to keep it. You can leave the session, and rejoin later.',
  hostWaiting: 'Waiting for the connection service to release this session. This can take a minute.',
  tooManyTabs: 'This session is open in another tab.',
  takeOver: 'Take over',
  takeOverTitle: 'This session is open in another tab',
  takeOverText: 'Only one tab can host the session. If you take over, the other tab becomes read-only.',
  takenOverNotice: 'This session is now hosted in another tab. This tab is read-only.',
  takeOverFailed: 'The other tab did not let go. Close it and try again.',

  // ended / removed
  endedHeading: 'The session has ended',
  endedText: 'Thank you for taking part.',
  leaveEnded: 'Done: remove this session from this device',
  removedHeading: 'You were removed from the session',
  removedText: 'The Facilitator removed you from this session.',
  toHome: 'Back to the start page',
} as const;
