export type SubmissionStatus = 'downloaded' | 'pending' | 'expired';

export type Submission = {
  id: string;
  phone: string;
  fileName: string;
  createdAt: number;
  status: SubmissionStatus;
};
