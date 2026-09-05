export type SubmissionStatus = 'pending' | 'viewed' | 'downloaded' | 'expired' | 'revoked' | 'locked';

export type Submission = {
  id: string;
  patientName: string;
  fileName: string;
  createdAt: number;
  status: SubmissionStatus;
};
