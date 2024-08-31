import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import smartsheets from "../assets/smartsheets.png";
import "../components/Appbar.css";
import { useState, useEffect, useCallback } from "react";
import Spreadsheet from "react-spreadsheet";
import func from "../assets/function.png";
import io from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { debounce } from "lodash";
import 'handsontable/dist/handsontable.full.min.css';
import Handsontable from 'handsontable/base';
import { registerAllModules } from 'handsontable/registry';
import { HotTable } from '@handsontable/react';

const Sheet = () => {

  // --------------------------------> Navigation <-----------------------------------
  const navigate = useNavigate();
  const { sheetIdd } = useParams();  

  const handleHome = () => {
    navigate("/");
  };

  registerAllModules();

  // -----------------------------------> States <------------------------------------
  const [Tab, setTab] = useState("Edit");
  const [FileName, setFileName] = useState("Untitled Spreadsheet");
  const [copiedData, setCopiedData] = useState([]);
  const [PrevSelection, setPrevSelection] = useState();
  const [Coordinate, setCoordinate] = useState("____");
  const [FuncText, setFuncText] = useState("");
  const [socket, setSocket] = useState();
  const [formulaBarData, setFormulaBarData] = useState({rowNum: null, colNum: null, value: ""});
  const [History, setHistory] = useState([]);
  const [Current, setCurrent] = useState(0);
  const [sheetId, setSheetId] = useState("");
  const [data, setData] = useState([]);

  const handleCellClick = (cell) => {
    if (cell.range === undefined) {
      setCoordinate("____");
      return;
    }
    setPrevSelection(cell);

    let rowNum = cell.range.start.row;
    let colNum = cell.range.start.column;
    let value = data[rowNum][colNum].value;

    if (
      cell.range.start.row == cell.range.end.row &&
      cell.range.start.column == cell.range.end.column
    ) {
      setCoordinate(String.fromCharCode(65 + colNum) + (rowNum + 1));
    } else {
      setCoordinate(
        String.fromCharCode(65 + cell.range.start.column) +
          (cell.range.start.row + 1) +
          ":" +
          String.fromCharCode(65 + cell.range.end.column) +
          (cell.range.end.row + 1)
      );
    }
    setFuncText(data[cell.range.start.row][cell.range.start.column].value);
    setFormulaBarData({ rowNum, colNum, value });
  };


  // ----------------------------------> Edit Functions <-----------------------------------
  const handleUndo = () => {
    if (Current > 0) {
      let hist = [...History];
      setData(hist[Current - 1]);
      setCurrent(Current - 1);
    }
  };

  const handleRedo = () => {
    if (Current < History.length - 1) {
      let hist = [...History];
      setData(hist[Current + 1]);
      setCurrent(Current + 1);
    }
  };

  const sortSelectedData = () => {
    const { start, end } = PrevSelection.range;
    let startRow = start.row;
    let startCol = start.column;
    let endRow = end.row;
    let endCol = end.column;

    let temp = [];

    for (let i = startRow; i <= endRow; i++) {
      let row = [];
      for (let j = startCol; j <= endCol; j++) {
        row.push(data[i][j].value);
      }
      temp.push(row);
    }
    let temp1 = [];
    for (let i = 0; i < temp.length; i++) {
      for (let j = 0; j < temp[0].length; j++) {
        temp1.push(temp[i][j]);
      }
    }
    temp1.sort((a, b) => parseFloat(a) - parseFloat(b));
    for (let i = 0; i < temp.length; i++) {
      for (let j = 0; j < temp[0].length; j++) {
        temp[i][j] = temp1[i * temp[0].length + j];
      }
    }

    let newData = [...data];

    for (let i = startRow; i <= endRow; i++) {
      for (let j = startCol; j <= endCol; j++) {
        newData[i][j].value = temp[i - startRow][j - startCol];
      }
    }

    setData(newData);
  };

  const handleCopy = () => {
    const { start, end } = PrevSelection.range;
    let startRow = start.row;
    let startCol = start.column;
    let endRow = end.row;
    let endCol = end.column;

    let temp = [];

    let cellData = [...data];
    for (let i = startRow; i <= endRow; i++) {
      let row = [];
      for (let j = startCol; j <= endCol; j++) {
        row.push(cellData[i][j]);
      }
      temp.push(row);
    }

    setCopiedData(temp);
  };

  const handlePaste = () => {
    const { start } = PrevSelection.range;
    let startRow = start.row;
    let startCol = start.column;

    let newData = [...data];

    for (let i = 0; i < copiedData.length; i++) {
      for (let j = 0; j < copiedData[i].length; j++) {
        if (startRow + i < rows && startCol + j < columns) {
          newData[startRow + i][startCol + j] = copiedData[i][j];
        }
      }
    }

    setData(newData);
  };

  const handleDelete = () => {
    const { start, end } = PrevSelection.range;
    let startRow = start.row;
    let startCol = start.column;
    let endRow = end.row;
    let endCol = end.column;

    let temp = [];

    let cellData = [...data];
    for (let i = startRow; i <= endRow; i++) {
      for (let j = startCol; j <= endCol; j++) {
        cellData[i][j] = "";
      }
    }

    setCopiedData(temp);
  };

  //------------------------------------> File Functions <-----------------------------------

  const convertToCSV = (data) => {
    return data
      .map((row) => row.map((cell) => cell.value).join(","))
      .join("\n");
  };

  const downloadCSV = () => {
    const csvData = convertToCSV(data);
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spreadsheet.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRename = () => {
    const newName = prompt("Enter New File Name");
    if (newName) {
      setFileName(newName);
    }
  };

  const handleNewFile = () => {
    const id = uuidv4();
    navigate(`/sheet/${id}`);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const contents = e.target.result;
        const rows = contents.split("\n");
        let newData = rows.map((row) => row.split(","));
        newData = newData.map((row) => row.map((cell) => ({ value: cell })));
        setData(newData);
      };
      reader.readAsText(file);
    };
    input.click();
  };


  // ------------------------------> Change Handler Functions <-----------------------------------


    // const handleDataChange = useCallback(
    //   debounce((newData) => {
    //     console.log("Data changed");
    //     setData(newData);
    //   }, 300), 
    //   []
    // );

    const handleDataChange = useCallback(
      debounce((newData) => {
          console.log("updated")
          setData((prevData) => {
              if (JSON.stringify(prevData) !== JSON.stringify(newData)) {
                  return newData;
              }
              return prevData;
          });
      }, 1), // Adjust the debounce delay as needed
      []
  );

  

  const handleChange = (e) => {
    setFuncText(e.target.value);
    setFormulaBarData({ ...formulaBarData, value: e.target.value });
  };

  const handleKeyDown = (event) => {
    let formulaTillNow = FuncText;
    formulaTillNow = formulaTillNow + String.fromCharCode(event.keyCode);
    setFuncText(formulaTillNow);
  };

  // ----------------------> UseEffects <---------------------------

  useEffect(() => {
    let id = sheetId;
    if (!id) {
      id = uuidv4();
      navigate(`/sheet/${id}`);
    }
    setSheetId(id);

    let rows = 100;
    let columns = 26;
    let cells = [];
    for (let i = 0; i < rows; i++) {
      let row = [];
      for (let j = 0; j < columns; j++) {
        row.push("");
      }
      cells.push(row);
    }
    setData(cells);
  }, [sheetId, navigate]);

  useEffect(() => {
    const { rowNum, colNum, value } = formulaBarData;
    if (rowNum !== null && colNum !== null) {
      const updatedData = [...data];
      updatedData[rowNum][colNum] = { value };
      // setData(updatedData);
      setHistory([...History, updatedData]);
      setCurrent(Current + 1);
    }
  }, [formulaBarData]);

  useEffect(() => {
    const s = io("http://localhost:3000"); // Replace with your backend URL
    setSocket(s);

    s.on("connect", () => {
      console.log("connected");
      console.log(s); // Log the socket instance directly
      s.emit("joinSheet", sheetId); // Join the sheet room
      s.emit("save-document", { sheetId, data });
      // s.emit("editCell", {
      //   sheetId,
      //   cell: { row: 0, col: 0 },
      //   value: "Hello World",
      // })
    });

    s.on("cellUpdated", ({ cell, value }) => {
      const { row, col } = cell;
      const updatedData = [...data];
      updatedData[row][col] = { value };
      setData(updatedData);
      console.log("cell updated");
    });

    return () => {
      s.disconnect();
    };
  }, [sheetId]);

  return (
    <div>
      <div className="navbar h-44">
        {/* logo */}
        <div className="div1">
          <img
            onClick={handleHome}
            src={smartsheets}
            alt="smartsheets"
            className="cursor-pointer h-16 w-32 mt-10 ml-8"
          />
        </div>

        {/* profile */}
        <div className="div2">
          <button className="rounded-full h-16 w-16 bg-[#EAF1FF] flex justify-center mt-10">
            <div className="flex flex-col justify-center h-full text-xl">
              👤
            </div>
          </button>
        </div>

        {/* tabs */}
        <div className="div3 flex gap-6">
          <button
            onClick={(e) => {
              setTab("File");
            }}
            className={`${
              Tab === "File" ? "font-bold text-blue-500" : ""
            } flex flex-col h-8 mr-8 mt-6 hover:text-blue-500`}
          >
            File
          </button>
          <button
            onClick={(e) => {
              setTab("Edit");
            }}
            className={`${
              Tab === "Edit" ? "font-bold text-blue-500" : ""
            } flex flex-col h-8 mr-8 mt-6 hover:text-blue-500`}
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              setTab("View");
            }}
            className={`${
              Tab === "View" ? "font-bold text-blue-500" : ""
            } flex flex-col h-8 mr-8 mt-6 hover:text-blue-500`}
          >
            View
          </button>
          <button
            onClick={(e) => {
              setTab("Insert");
            }}
            className={`${
              Tab === "Insert" ? "font-bold text-blue-500" : ""
            } flex flex-col h-8 mr-8 mt-6 hover:text-blue-500`}
          >
            Insert
          </button>
        </div>

        {/* search */}
        <div className="div4">
          <input
            className="focus:caret-transparent focus:outline-none rounded-full h-10 w-[35rem] bg-[#EAF1FF] text-[rgba(0,0,0,0.5)] mt-5 text-center placeholder-center"
            value={FileName}
            onClick={handleRename}
            readOnly={true}
          />
        </div>

        {/* tabs */}
        <div className="div5 flex gap-6">
          <button
            onClick={(e) => {
              setTab("Collaborate");
            }}
            className={`${
              Tab === "Collaborate" ? "font-bold text-blue-500" : ""
            } flex flex-col h-8 mr-8 mt-6 hover:text-blue-500`}
          >
            Collaborate
          </button>
          <button
            onClick={(e) => {
              setTab("Comments");
            }}
            className={`${
              Tab === "Comments" ? "font-bold text-blue-500" : ""
            } flex flex-col h-8 mr-8 mt-6 hover:text-blue-500`}
          >
            Comments
          </button>
          <button
            onClick={(e) => {
              setTab("Share");
            }}
            className={`${
              Tab === "Share" ? "font-bold text-blue-500" : ""
            } flex flex-col h-8 mr-8 mt-6 hover:text-blue-500`}
          >
            Share
          </button>
        </div>

        {/* main functions */}

        {Tab === "File" && (
          <div className="div6 flex h-14 gap-6">
            <button
              onClick={handleNewFile}
              className="hover:bg-blue-100 border p-4 rounded w-32 bg-[#EAF1FF]"
            >
              New File
            </button>
            <button
              onClick={downloadCSV}
              className="hover:bg-blue-100 border rounded p-4 bg-[#EAF1FF] w-32"
            >
              Download
            </button>
            <button
              onClick={handleImport}
              className="hover:bg-blue-100 border rounded p-4 bg-[#EAF1FF] w-32"
            >
              Import CSV
            </button>
            <button
              onClick={handleRename}
              className="hover:bg-blue-100 border rounded p-4 bg-[#EAF1FF] w-32"
            >
              Rename
            </button>
          </div>
        )}

        {Tab === "Edit" && (
          <div className="div6 flex h-14 gap-6">
            <button
              onClick={handleUndo}
              className="hover:bg-blue-100 border p-4 rounded w-32 bg-[#EAF1FF]"
            >
              Undo
            </button>
            <button
              onClick={handleRedo}
              className="hover:bg-blue-100 border p-4 rounded w-32 bg-[#EAF1FF]"
            >
              Redo
            </button>
            <button
              onClick={sortSelectedData}
              className="hover:bg-blue-100 border p-4 rounded w-32 bg-[#EAF1FF]"
            >
              Sort
            </button>
            <button
              onClick={handleCopy}
              className="hover:bg-blue-100 border rounded p-4 bg-[#EAF1FF] w-32"
            >
              Copy
            </button>
            <button
              onClickCapture={handlePaste}
              className="hover:bg-blue-100 border rounded p-4 bg-[#EAF1FF] w-32"
            >
              Paste
            </button>
            <button
              onClick={handleDelete}
              className="hover:bg-blue-100 border rounded p-4 bg-[#EAF1FF] w-32"
            >
              Delete
            </button>
          </div>
        )}
      </div>

        {/* Formula Bar */}
      <div>
        .
        <div className="mt-36">
          <div className="formula fixed bg-[#EAF1FF] h-12 w-screen flex items-center text-[1rem] rounded">
            <input
              value={Coordinate}
              readOnly={true}
              className="focus:caret-transparent focus:outline-none ml-8 h-full w-16 bg-[#EAF1FF] shadow-[rgba(0,0,0,0.1)_1px_0px_0px_0px]"
            ></input>
            <div
              value={Coordinate}
              className="ml-9 flex justify-center items-center h-full w-screen rounded-l-full m"
            >
              <img src={func} alt="func" className="h-8 w-8" />
              <input
                onChange={handleChange}
                className="focus:outline-none ml-6 h-full w-screen bg-[#EAF1FF]"
                placeholder="Enter formula here"
                value={FuncText}
              />
            </div>
          </div>
        </div>
        
        {/* <Spreadsheet
          className="mt-12"
          data={data}
          onChange={(data)=>handleDataChange(data)}
          onSelect={(selected) => handleCellClick(selected)}
          onKeyDown={handleKeyDown}
        /> */}
      </div>
    </div>
  );
};

export default Sheet;

