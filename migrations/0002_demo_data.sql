
-- Fictional demonstration inventory only; not a real-estate advertisement.
INSERT OR REPLACE INTO listings(id,status,area,type,deal,deposit,monthly_rent,area_exclusive,floor,direction,memo,thumbnail,photos_json,updated_at)
VALUES
('DEMO-001','진행중','가상동 샘플구역 A','오피스텔','월세',1000,60,'28㎡','3층','남향','가상 테스트 매물입니다. 실제 거래할 수 없습니다.','','[]',1730000300),
('DEMO-002','진행중','가상동 샘플구역 B','상가','월세',3000,200,'60㎡','1층','동향','보안 테스트용 가상 상가입니다. 실제 거래할 수 없습니다.','','[]',1730000200),
('DEMO-003','진행중','가상동 샘플구역 C','원룸','전세',8000,0,'24㎡','2층','서향','테스트 전용 가상 매물입니다.','','[]',1730000100),
('DEMO-OLD','거래완료','가상동 샘플구역 D','원룸','월세',500,40,'20㎡','4층','북향','비공개 처리 확인용 샘플입니다.','','[]',1730000000);
