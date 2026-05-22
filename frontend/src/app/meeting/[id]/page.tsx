'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import MeetingRoom from '@/components/MeetingRoom';

export default function MeetingPage() {
  const params = useParams();
  const meetingId = params.id as string;

  return <MeetingRoom meetingId={meetingId} />;
}
