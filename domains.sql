-- --------------------------------------------------------
-- Host:                         0.0.0.0
-- Versión del servidor:         12.2.2-MariaDB-ubu2404 - mariadb.org binary distribution
-- SO del servidor:              debian-linux-gnu
-- HeidiSQL Versión:             12.11.0.7065
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Volcando datos para la tabla db.domains: ~19 rows (aproximadamente)
INSERT INTO `domains` (`site`, `domains`) VALUES
	('Api', 'embedez.com/download|discord.com'),
	('API_NSFW', 'danbooru.donmai.us|derpibooru.org|e621.net|e926.net|gelbooru.com|rule34.xxx|safebooru.org|hypnohub.net|konachan.com|yande.re|rule34.paheal.net|xbooru.com|tbib.org'),
	('API_SFW', 'tiktok.com|reddit.com|ifunny.co|snapchat.com|imgur.com|pinterest.com'),
	('bilibili', 'vxbilibili.com|bilibili.com'),
	('bluesky', 'bskyx.app|bsky.app'),
	('deviantart', 'fixdeviantart.com|deviantart.com'),
	('facebook', 'facebed.com|facebook.com'),
	('facebookVideo', 'fixacebook.com|facebook.com'),
	('furaffinity', 'xfuraffinity.net|furaffinity.net'),
	('instagram', 'vxinstagram.com|instagram.com'),
	('iwara', 'fxiwara.seria.moe|iwara.tv'),
	('pixiv', 'phixiv.net|pixiv.net'),
	('reddit', 'rxddit.com|vxreddit.com|reddit.com'),
	('threads', 'fixthreads.seria.moe|threads.com'),
	('tiktok', 'tnktok.com|tiktokez.com|tiktok.com'),
	('tumblr', 'txtumblr.com|tumblr.com'),
	('twitch', 'fxtwitch.seria.moe|twitch.tv'),
	('twitter', 'fxtwitter.com|fixvx.com|x.com'),
	('youtube', 'youtu.be');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
