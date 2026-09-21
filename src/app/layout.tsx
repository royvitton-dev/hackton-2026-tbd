import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'EVision — Vehicle Battery Intelligence',description:'WebGL 3D 차량과 사용자별 충전 습관 기반 배터리 관리 대시보드'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
