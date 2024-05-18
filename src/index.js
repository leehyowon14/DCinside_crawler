const axios = require('axios');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { load } = require('cheerio');

async function updatePost(gallaryLink, limit = 0) {
    //갤러리 링크 -> Mini-OO, Minor-OO, OO으로 변환하여 json파일의 이름으로 저장.
    //미니갤: mini, 마이너갤: mgallery, 갤: 없음.

    let filePath = "";
    //prefix
    if (gallaryLink.includes("mini")) {
        prefix = "Mini-";
    } else if (gallaryLink.includes("mgallery")) {
        prefix = "Minor-";
    }

    filePath = `src/JSON/${prefix}${/\?id=.*/.exec(gallaryLink)[0].split("&")[0].split("=")[1]}.json`;

    if (!existsSync(filePath)) {
        writeFileSync(filePath, readFileSync('src/JSON/original_form.json', 'utf8'));
    }

    let data = JSON.parse(readFileSync(filePath, 'utf8'));
    let {lastPostNumber} = data;
    data.gallaryLink = gallaryLink;

    let res = await axios.get(`${gallaryLink}&list_num=100&sort_type=N&page=1`);
    let html = res.data;
    let $ = load(html);

    let firstPostIdx, postNumber //변수 초기화
    //공지 등을 제외시킨 첫 게시물이 .listwrap2클래스를 가진 tbody의 몇번째 자식인지 찾기
    for (let idx = 0; idx < 100; idx++) {
        postNumber = parseInt($(`.listwrap2 .us-post`).attr("data-no"));
        if (!isNaN(postNumber)) {
            limit = limit || postNumber - lastPostNumber;
            //첫 실행 시에는 초기화
            if (lastPostNumber == 0) {
                data.lastPostNumber = postNumber;
                data.lastUpdateDate = Date.now();
                writeFileSync(filePath, JSON.stringify(data));
            }
            firstPostIdx = idx;
            break;
        }
    }

    let resultArray = [];
    let currentPage = 1
    while (lastPostNumber != postNumber && lastPostNumber != 0) {
        const postElementArray = Array.from($(".listwrap2 .us-post"))
        for (let idx = firstPostIdx; idx < postElementArray.length; idx++) {
            postElement = $(postElementArray[idx]);
            postNumber = parseInt(postElement.find('.gall_num').text())
            if (postNumber == lastPostNumber || postNumber == 1 || resultArray.length == limit) break;

            const postWriterIP = postElement.find('.gall_writer').attr("data-ip");
            resultArray.push(
                {
                    "postNumber": postNumber,
                    "postTitle": postElement.find('td.gall_tit.ub-word > a:nth-child(1)').text().trim(),
                    "postDate": postElement.find('.gall_date').attr("title"),
                    "postWriter": `${postElement.find('.gall_writer').attr("data-nick")}(${postWriterIP.length > 0 ? postWriterIP : "고닉"})`
                }
            );

            //조건 맞으면 탈출
        }
        //조건 맞으면 탈출
        if (postNumber == lastPostNumber || postNumber == 1 || resultArray.length == limit) {
            data.lastUpdateDate = Date.now();
            data.lastPostNumber = resultArray[0].postNumber;
            data.postInfo = resultArray;

            writeFileSync(filePath, JSON.stringify(data));
            break;
        }

        //다음페이지 크롤링
        currentPage++
        res = await axios.get(`${gallaryLink}&list_num=100&sort_type=N&page=${currentPage}`);
        html = res.data;
        $ = load(html);
    }

    return resultArray;
}
