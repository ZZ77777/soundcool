import React from "react";
import NavigationPrompt from "react-router-navigation-prompt";
import "./index.css";
import { connect } from "react-redux";
import { default as RDraggable } from "react-draggable";
import WithHeader from "./Components/WithHeader";
import AddBlock from "./Components/AddBlock";
import { StoreX as Store } from "../../storeX";
import { instanceOf } from "prop-types";
import {
  showToastr,
  showToastrError,
  isUserLoggedIn,
  cleanPayload,
  getCurrentProjectId,
  commonSocket,
} from "../../actions/common";
import {
  createProject,
  fetchUserProject,
  openPort,
  updateProject,
} from "./actions";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { loadProject } from "./thunks.js";
//import {specValues, audioDefaults} from "/Components/AddBlock.jsx";
import Cookies from "universal-cookie";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Nav,
  Navbar,
  NavItem,
} from "reactstrap";
import { NavLink, withRouter } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
import RegisterForm from "../register/form";
import LoginForm from "../login/form";
import FormInput from "../form/FormInput";

const cookies = new Cookies();

// a little function to help us with reordering the result
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

const getItemStyle = (isDragging, draggableStyle) => ({
  userSelect: "none",
  ...draggableStyle,
  boxShadow: isDragging
    ? `0 25px 50px rgba(255,20,147,0.50), 0 20px 15px rgba(255,20,147,0.42)`
    : "",
});

const move = (source, destination, droppableSource, droppableDestination) => {
  const sourceClone = Array.from(source);
  const destClone = Array.from(destination);
  const [removed] = sourceClone.splice(droppableSource.index, 1);

  destClone.splice(droppableDestination.index, 0, removed);

  const result = [];
  result.push({ value: sourceClone, id: droppableSource.droppableId });
  result.push({ value: destClone, id: droppableDestination.droppableId });

  return result;
};

const getListStyle = (isDraggingOver) => ({
  width: "13rem",
  background: isDraggingOver ? "lightblue" : "transparent",
});

class ProjectEditor extends React.Component {
  static propTypes = {
    cookies: instanceOf(Cookies).isRequired,
  };

  constructor(props) {
    console.log(
      "ProjectEditor constructor: " + JSON.stringify(props.match.params.id)
    ); // RBDDBG
    super(props);
    this.state = {
      nextLocation: null,
      projectId: this.props.match.params.id,
      items: [[], [], [], [], []],
      orderingItems: [[], [], [], [], []],
      dragState: [],
      resizeState: [[], [], [], [], []],
      prevItems: this.props.blocks.bs,
      projectName: "",
      projectDescription: "",
      openPorts: [],
      isProjectChanged: false,
      view: localStorage.getItem("editorView" + this.props.match.params.id)
        ? localStorage.getItem("editorView" + this.props.match.params.id)
        : localStorage.getItem("editorView")
        ? localStorage.getItem("editorView")
        : "Column",
      projectsDropdownOpen: false,
      viewDropdownOpen: false,
      sharingDropdownOpen: false,
      recentProjectsDropdownOpen: false,
      isModalOpen: false,
      isRegisterModalOpen: false,
      isLoginModalOpen: false,
    };
    this.canvasRef = React.createRef();
    this.onDragEnd = this.onDragEnd.bind(this);
    this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
    this.toggleViewDropdown = this.toggleViewDropdown.bind(this);
    this.toggleProjectsDropdown = this.toggleProjectsDropdown.bind(this);
    this.toggleSharingDropdown = this.toggleSharingDropdown.bind(this);
    this.toggleRecentProjectsDropdown =
      this.toggleRecentProjectsDropdown.bind(this);
    this.timer = null;
  }

  getList = (id) => {
    let x = this.state["items"];
    return x[id.split("_")[1]];
  };
  onDragEnd = (result) => {
    const { source, destination } = result;
    // dropped outside the list
    if (!destination) {
      return;
    }
    // console.log(source, destination);
    if (source.droppableId === destination.droppableId) {
      const items = reorder(
        this.getList(source.droppableId),
        source.index,
        destination.index
      );

      let finalResult = this.state.items;
      finalResult[parseInt(source.droppableId.split("_")[1])] = items;

      this.setState({ items: finalResult });
    } else {
      const result = move(
        this.getList(source.droppableId),
        this.getList(destination.droppableId),
        source,
        destination
      );
      let finalResult = this.state.items;
      finalResult[parseInt(result[0]["id"].split("_")[1])] = result[0]["value"];
      finalResult[parseInt(result[1]["id"].split("_")[1])] = result[1]["value"];
      this.setState({
        items: finalResult,
      });
      this.setState({ dragState: [...finalResult] });
      this.props.dispatch({
        type: "POSITION_BLOCK",
        positions: this.state.items.map((item) => item.map((i) => i.id)),
      });
    }
  };

  blockStyle = (id) => {
    const top = (id % 15) * 20 + "px";
    const left = (id % 15) * 20 + "px";
    const zIndex = this.state.selectedBlock
      ? id === this.state.selectedBlock
        ? 1
        : 0
      : 0;
    return {
      position: "absolute",
      top: top,
      left: left,
      zIndex: zIndex,
    };
  };

  handleStop = (arg) => {
    console.log(arg);
  };

  renderBlockList = (blocks, nowOut) => {
    blocks = blocks.map((column) => {
      const col = column.filter((item) => item !== undefined);
      return col;
    });
    if (this.state.view === "Floating") {
      let finalBlock = [];
      blocks.forEach((o) => {
        finalBlock = finalBlock.concat(o);
      });

      console.log(finalBlock);
      return (
        <div
          style={{
            top: "5px",
            height: this.state.windowH - 95,
            width: this.state.windowW - 20,
            position: "relative",
          }}
        >
          <div className="boxContainer">
            {finalBlock.map((b) => (
              <RDraggable
                // position={{ x: 0, y: 0 }}
                bounds="parent"
                cancel="input"
                onStop={this.handleStop}
                onDrag={() => {
                  if (this.state.selectedBlock !== b.id) {
                    this.setState({ selectedBlock: b.id });
                  }
                }}
              >
                <div
                  className="no-cursor"
                  onClick={() => {
                    this.setState({ selectedBlock: b.id });
                  }}
                  style={this.blockStyle(b.id)}
                >
                  <div>
                    <WithHeader
                      key={b.id}
                      blockInfo={b}
                      nowOut={nowOut}
                      disableOsc={true}
                    />
                  </div>
                </div>
              </RDraggable>
              // <ExampleWrapper />
            ))}
          </div>
        </div>
      );
    } else {
      return (
        <React.Fragment>
          <DragDropContext onDragEnd={this.onDragEnd}>
            {blocks.map((b, listIndex) => (
              <div
                style={{
                  paddingTop: "5px",
                  paddingLeft: "10px",
                }}
              >
                <Droppable droppableId={"droppable_" + listIndex}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      style={getListStyle(snapshot.isDraggingOver)}
                    >
                      {b.map((item, index) => (
                        <Draggable
                          key={item.id}
                          draggableId={item.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={getItemStyle(
                                snapshot.isDragging,
                                provided.draggableProps.style
                              )}
                            >
                              <WithHeader
                                key={item.id}
                                blockInfo={item}
                                nowOut={nowOut}
                                disableOSC={true}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </DragDropContext>
        </React.Fragment>
      );
    }
  };

  componentWillReceiveProps(nextProps) {
    if (nextProps.match.params.id !== this.props.match.params.id)
      this.setState({ projectId: nextProps.match.params.id }, () => {
        this.loadState();
      });
    // sync the item list with the block list - create ordering of the blocks
    if (
      this.state.prevItems !== nextProps.blocks.bs ||
      this.state.projectId === "new"
    ) {
      let length = this.state.items.length;
      let newValue = [];
      for (let i = 0; i < length; i++) {
        newValue[i] = [];
      }
      nextProps.blocks.bs.forEach((o) => {
        this.state.items.every((arr, index) => {
          arr = arr.filter((e) => e !== undefined);
          const found = arr.find((element) => element["id"] === o["id"]);
          if (found === undefined) {
            if (index === length - 1) {
              newValue[0].push(o);
            }
            return true;
          } else {
            const i = arr.findIndex((element) => element["id"] === o["id"]);
            newValue[index][i] = o;
            return false;
          }
        });
      });
      if (this.state.projectId === "new") {
        // console.log(nextProps.blocks);
        // localStorage.setItem("localProject", JSON.stringify(nextProps.blocks)); ////////////
      }

      let opts = {};
      if (
        this.state.loadCount &&
        this.state.loadCount === nextProps.blocks.bs.length
      ) {
        var connectionCount = 0;
        nextProps.blocks.bs.forEach((bs) => {
          connectionCount += bs["inNode"].length + bs["outNode"].length;
        });
        if (this.state.connectionCount > 0) {
          if (connectionCount === this.state.connectionCount) {
            opts = {
              isLoadingConn: false,
              loadCount: undefined,
              connectionCount: 0,
              isProjectChanged: false,
            };
          } else {
            opts = { isLoadingComp: false };
          }
        } else {
          opts = {
            isLoadingComp: false,
            isLoadingConn: false,
            loadCount: undefined,
            connectionCount: 0,
            isProjectChanged: false,
          };
        }
      }
      // console.log(opts);
      // console.log(nextProps.blocks.bs);
      this.setState({
        isProjectChanged: nextProps.blocks.bs.length > 0,
        items: newValue,
        prevItems: nextProps.blocks.bs,
        ...opts,
      });
    }
  }

  componentDidMount() {
    window.onbeforeunload = null;
    this.loadState();
    this.updateWindowDimensions();
    window.addEventListener("resize", this.updateWindowDimensions);
    let projectId = getCurrentProjectId();
    if (projectId) {
      commonSocket.emit("joinRoom", projectId);
    }
    commonSocket.on("openPort", (data) => {
      // console.log(data);
      this.setState({
        openPorts: data,
      });
    });
    commonSocket.on("oscData", (data) => {
      console.log("received oscData");
      let portNumber = data.portNumber;
      let targetType = data.component;
      let targetComponent = this.findComponents(portNumber, targetType);
      targetComponent.forEach((comp) => {
        this.handleOscInput(comp, data);
      });
    });
    commonSocket.on("changeBlock", (data) => {
      data["isStreamed"] = true;
      this.props.dispatch(data);
    });
    setTimeout(() => {
      const allItems = this.state.items.reduce(
        (prev, cur) => prev.concat(cur),
        []
      );
      console.log(this.state);

      const newItems = this.state.positions
        ? this.state.positions.map((col) =>
            col.map((id) => allItems.find((item) => item.id === id))
          )
        : undefined;

      console.log(newItems);
      const newResizeState = [];
      if (newItems == null || newItems.length === 0) {
        console.log("HERE");
      } else {
        console.log("****");
        newResizeState[newItems.length - 1] = newItems;
        this.setState({
          items: newItems,
          resizeState: newResizeState,
          dragState: [...newItems],
        });
      }
    }, 1000);
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.updateWindowDimensions);
  }

  updateWindowDimensions() {
    let maxColumn = Math.floor((window.innerWidth - 100) / 220);
    let items = this.state.items;
    console.log(this.state);
    if (items.length !== maxColumn) {
      let sizeChange = maxColumn - items.length;
      if (sizeChange > 0) {
        while (sizeChange--) {
          items.push([]);
        }
        if (maxColumn === this.state.dragState.length) {
          items = [...this.state.dragState];
        }
        if (maxColumn < this.state.dragState.length) {
          items = [...this.state.resizeState[maxColumn - 1]];
        }
      } else if (sizeChange < 0) {
        while (sizeChange++ < 0) {
          console.log("ITEM LIST" + items + items.length);
          if (items.length > 1) {
            items[items.length - 2] = items[items.length - 2].concat(
              items[items.length - 1]
            );
            items.pop();
            const newResizeState = this.state.resizeState;
            newResizeState[maxColumn - 1] = [...items];
            this.setState({ resizeState: newResizeState });
          }
        }
      }
    }
    this.setState({
      windowW: window.innerWidth,
      windowH: window.innerHeight,
      items: items,
    });
  }

  findComponents(oscPort, targetType) {
    let components = [];
    this.props.blocks["bs"].forEach((comp, index) => {
      if (
        !!comp.oscPort &&
        comp.oscPort === oscPort &&
        comp.typeName === targetType
      ) {
        components.push({ id: comp.id, index: index });
      }
    });
    return components;
  }

  handleOscInput(comp, data) {
    switch (data.component) {
      case "Delay":
        break;
      case "Transposer":
        break;
      case "Pan":
        break;
      case "Player":
        this.handleOscPlayer(comp.id, comp.index, data);
        break;
      case "SignalGen":
        break;
      case "GranSynth":
        break;
      case "Speaker":
        break;
      case "DirectInput":
        break;
      case "Pitch":
        break;
      case "Reverb":
        break;
      case "Routing":
        break;
      case "Mixer":
        this.handleOscMixer(comp.id, data);
        break;
      case "Oscilloscope":
        break;
      case "Spectroscope":
        break;
      case "SamplePlayer":
        this.handleOscSamplePlayer(comp.id, comp.index, data);
        break;
      default:
        console.log("Unhandles case " + data.component);
    }
  }

  handleOscSamplePlayer(id, index, data) {
    let field,
      value,
      num = {},
      ignore = false,
      ind;
    switch (data.type) {
      case "random":
        field = "random";
        value = data.value === 1 ? true : false;
        break;
      case "loop":
        field = "loop";
        value = data.value === 1 ? true : false;
        break;
      case "playbackSpeed":
        field = "speed";
        value = data.value * 2;
        break;
      case "volume":
        field = "masterVolume";
        value = Math.round(data.value * 100);
        break;
      case "playPause":
        ind = data.value[0] - 1;
        if (
          data.value[1] === 0 &&
          this.props.blocks["bs"][index].audioObj.options[`path${ind}`] !== ""
        ) {
          if (this.props.blocks["bs"][index].audioObj.players[ind].isPlaying) {
            this.props.blocks["bs"][index].audioObj.pause(ind);
          } else {
            this.props.blocks["bs"][index].audioObj.play(ind);
          }
          field = "playings";
          value = undefined;
          num = { ind };
        } else {
          ignore = true;
        }
        break;
      case "stop":
        ind = data.value[0] - 11;
        if (
          data.value[1] === 0 &&
          this.props.blocks["bs"][index].audioObj.options[`path${ind}`] !== ""
        ) {
          field = "playings";
          value = undefined;
          num = { ind };
          this.props.blocks["bs"][index].audioObj.stop(ind);
        } else {
          ignore = true;
        }

        break;
      case "reverse":
        if (data.value === 0) {
          field = "reversed";
          value = undefined;
        } else {
          ignore = true;
        }

        break;
      default:
        console.log("Unhandles case " + data.type);
    }
    if (!ignore) {
      this.props.dispatch({
        type: "CHANGE_BLOCK",
        id: id,
        field,
        value,
        ...num,
      });
    }
  }

  handleOscPlayer(id, index, data) {
    let field,
      value,
      ignore = false;
    switch (data.type) {
      case "loop":
        field = "loop";
        value = data.value === 1 ? true : false;
        break;
      case "playbackSpeed":
        field = "speed";
        value = data.value * 2;
        break;
      case "volume":
        field = "volume";
        value = Math.round(data.value * 100);
        break;
      case "playPause":
        if (
          data.value === 0 &&
          this.props.blocks["bs"][index].audioObj.options.path !== ""
        ) {
          if (this.props.blocks["bs"][index].audioObj.isPlaying) {
            this.props.blocks["bs"][index].audioObj.pause();
          } else {
            this.props.blocks["bs"][index].audioObj.play();
          }

          field = "playing";
          value = undefined;
        } else {
          ignore = true;
        }
        break;
      case "stop":
        if (
          data.value === 0 &&
          this.props.blocks["bs"][index].audioObj.options.path !== ""
        ) {
          field = "playing";
          value = undefined;
          this.props.blocks["bs"][index].audioObj.stop();
        } else {
          ignore = true;
        }

        break;
      case "reverse":
        if (
          data.value === 0 &&
          this.props.blocks["bs"][index].audioObj.options.path !== ""
        ) {
          this.props.blocks["bs"][index].audioObj.reverse((res) => {
            // console.log(res);
          });
        } else {
          ignore = true;
        }

        break;
      case "seek":
        if (this.props.blocks["bs"][index].audioObj.options.path !== "") {
          this.props.blocks["bs"][index].audioObj.seek(data.value);
        }
        ignore = true;
        break;
      default:
        console.log("Unhandles case " + data.type);
    }
    if (!ignore) {
      this.props.dispatch({
        type: "CHANGE_BLOCK",
        id: id,
        field,
        value,
      });
    }
  }

  handleOscMixer(id, data) {
    let field, value;
    switch (data.type) {
      case "playerVolume":
        field = "node" + (data.value[0] - 1) + "Gain";
        value = data.value[1];
        break;
      case "mainVolume":
        field = "masterGain";
        value = data.value;
        break;
      default:
        console.log("Unhandles case " + data.type);
    }
    this.props.dispatch({
      type: "CHANGE_BLOCK",
      id: id,
      field,
      value,
    });
  }

  openNewPort(blocks) {
    blocks.forEach((block) => {
      if (
        block.osc &&
        block.oscPort &&
        this.state.openPorts.indexOf(block.oscPort) === -1
      ) {
        this.setState({ openPorts: [...this.state.openPorts, block.oscPort] });
        // console.log({ portNumber: block.oscPort });
        openPort({ portNumber: block.oscPort })
          .then((data) => {
            if (data.err) {
              console.log("ccccc:");
              showToastrError(data);
            } else {
              console.log("eeeee:");
              showToastr(data["message"]);
            }
          })
          .catch((error) => {
            console.log("fffff:");
            showToastrError(error);
          });
      }
    });
  }

  loadState() {
    if (this.state.projectId !== "new") {
      fetchUserProject(this.state.projectId)
        .then((res) => {
          let { name, description, content } = res;
          this.props.dispatch(loadProject(content));

          let parsedContent = JSON.parse(content) || {}; // Default to an empty object if null
          let parsedBS = parsedContent["bs"] || [];
          let loadCount = parsedBS.length;
          var connectionCount = 0;

          if (Array.isArray(parsedBS)) {
            parsedBS.forEach((bs) => {
              connectionCount +=
                (bs["inNode"]?.length || 0) + (bs["outNode"]?.length || 0);
            });
          }

          this.setState({
            loadCount,
            connectionCount,
            isLoadingComp: loadCount > 0,
            isLoadingCon: connectionCount > 0,
            projectName: name,
            projectDescription: description,
            positions: parsedContent["positions"] || [],
          });

          console.log(
            "loadState !new sets positions to " + this.state.positions
          );
        })
        .catch((err) => {
          // Ensure loading indicators are turned off on error
          this.setState({
            isLoadingComp: false,
            isLoadingCon: false,
          });

          showToastrError(err);
        });
    } else {
      const localProject = localStorage.getItem("localProject");
      // const safeLocalProject = localProject
      //   ? JSON.parse(localProject)
      //   : { bs: [], positions: [] };
      let safeLocalProject;

      try {
        const parsedProject = JSON.parse(localProject);
        safeLocalProject =
          typeof parsedProject === "object" && parsedProject !== null
            ? parsedProject
            : { bs: [], positions: [] };
      } catch (e) {
        safeLocalProject = { bs: [], positions: [] };
      }

      this.props.dispatch(loadProject(JSON.stringify(safeLocalProject)));

      this.setState({
        projectName: "",
        projectDescription: "",
        positions: safeLocalProject.positions || [],
        bs: safeLocalProject.bs || [],
      });

      console.log(
        "loadState new positions are " +
          this.state.positions +
          " name " +
          this.state.projectName
      );
    }
  }

  handleOnChange = (name, value) => {
    const params = { [name]: value };
    this.setState(params);
  };

  checkIfAllPortsAreOpen(blocks) {
    let flag = true;
    blocks.forEach((block) => {
      if (
        block.osc &&
        block.oscPort &&
        this.state.openPorts.indexOf(block.oscPort) === -1
      ) {
        flag = false;
      }
    });
    return flag;
  }

  toggleViewDropdown() {
    this.setState({ viewDropdownOpen: !this.state.viewDropdownOpen });
  }

  toggleProjectsDropdown() {
    this.setState({ projectsDropdownOpen: !this.state.projectsDropdownOpen });
  }

  toggleSharingDropdown() {
    this.setState({ sharingDropdownOpen: !this.state.sharingDropdownOpen });
  }

  toggleRecentProjectsDropdown() {
    this.setState({
      recentProjectsDropdownOpen: !this.state.recentProjectsDropdownOpen,
    });
  }

  handleOnChange = (name, value) => {
    const params = { [name]: value };
    this.setState(params);
  };

  copyname = () => {
    if (this.state.projectName.includes("copy")) {
      let projectNameList = this.state.projectName.split(" ");
      const idx = parseInt(
        projectNameList[projectNameList.indexOf("copy") + 1]
      );
      projectNameList[projectNameList.indexOf("copy") + 1] = (
        idx + 1
      ).toString();
      this.state.projectName = projectNameList.join(" ");
    } else {
      this.state.projectName = this.state.projectName + " copy 1";
    }
  };

  saveProject = (saveAs, callback) => {
    if (saveAs) {
      this.copyname();
    }

    if (isUserLoggedIn()) {
      if (this.state.projectId !== "new" && !saveAs) {
        this.setState({
          isProjectChanged: false,
        });

        this.updateProject({
          projectId: this.state.projectId,
          content: JSON.stringify(this.props.blocks),
        })
          .then((response) => {
            console.log("Response:", response); // Log the full response to inspect its structure

            if (
              response &&
              response.message === "Project Updated successfully"
            ) {
              callback && callback();
            } else {
              // Handle unsuccessful update here, maybe show a toastr message to notify the user
              showToastr("error", "Project update was not successful");
            }
          })
          .catch((error) => {
            console.error(error);
          });
      } else {
        this.saveCallback = callback;
        this.toggleModal();
      }
    } else {
      this.toggleLoginModal();
    }
  };

  updateProject = (payload) => {
    return new Promise((resolve, reject) => {
      updateProject(payload)
        .then((response) => {
          showToastr("success", "Project successfully updated");
          resolve(response); // resolving the promise with the response
        })
        .catch((error) => {
          showToastrError(error);
          reject(error); // rejecting the promise with the error
        });
    });
  };

  createProject = (event) => {
    event.preventDefault();

    let isFormValid = true,
      error = "";
    const { projectName, projectDescription } = this.state;
    const blocks = this.props.blocks;

    if (projectName === "") {
      error = "Project name is required";

      isFormValid = false;
    }

    if (isFormValid) {
      console.log(
        "createProject: this.props.blocks" + JSON.stringify(this.props.blocks)
      );
      let payload = {
        projectName,
        projectDescription,
        blocks,
      };

      createProject(payload)
        .then((data) => {
          showToastr("success", "Project created successfully");
          this.setState({ projectName: "", projectDescription: "" });

          // Call the saved callback function, if available
          if (this.saveCallback) {
            this.saveCallback();
          } else {
            // window.location = "/project-editor/" + data.project_id;
            setTimeout(() => {
              window.location = "/project-editor/" + data.project_id;
            }, 1400); // Delay of 5 seconds
          }
        })
        .catch((error) => {
          showToastrError(error);
        });
    } else {
      showToastrError({ error });
    }
  };

  exportProject = () => {
    const { projectName, projectDescription } = this.state;

    let bs = this.props.blocks.bs;
    let nowOut = this.props.blocks.nowOut;
    let blocks = {
      bs,
      nowOut,
    };
    this.downloadFile({
      projectName,
      projectDescription,
      blocks,
    });
    showToastr("success", "Project has been exported");
  };

  downloadFile = async (myData) => {
    const fileName = myData.projectName;
    const json = JSON.stringify(myData, null, "\u0020");
    let readData = JSON.parse(json);
    readData.blocks = cleanPayload(readData.blocks);
    const updatedJson = JSON.stringify(readData, null, "\u0020");
    const blob = new Blob([updatedJson], { type: "application/json" });
    const href = await URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName + ".json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  toggleModal = () => this.setState({ isModalOpen: !this.state.isModalOpen });

  toggleRegisterModal = () => {
    this.setState({ isRegisterModalOpen: !this.state.isRegisterModalOpen });
  };

  toggleLoginModal = () => {
    this.setState({ isLoginModalOpen: !this.state.isLoginModalOpen });
  };
  toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.log);
    } else {
      document.exitFullscreen().catch(console.log);
    }
  };

  afterRegister = (res) => {
    const { token, error, name } = res;
    if (error) {
      showToastrError("mlmlm", res);
    } else {
      cookies.set("name", name, { path: "/" });
      cookies.set("token", token, { path: "/" });
      Store.populateFromProps({
        userToken: { email: undefined, token: token },
      });
      showToastr("success", "Please enter project details");
      this.toggleRegisterModal();
      this.toggleModal();
    }
  };

  afterSignin = (res) => {
    const { token, error, name } = res;
    if (error) {
      showToastrError("kokok", res);
    } else {
      showToastr("success", "Logged in successfully.");
      cookies.set("name", name, { path: "/" });
      cookies.set("token", token, { path: "/" });
      Store.populateFromProps({
        userToken: { email: undefined, token: token },
      });
      this.toggleLoginModal();
      this.toggleModal();
    }
  };

  render() {
    var recentP = localStorage.getItem("recentProjects")
      ? JSON.parse(localStorage.getItem("recentProjects"))
      : [];

    // console.log(this.state.isProjectChanged);
    let fileReader;
    let { items } = this.state;
    const openPortsButton = this.checkIfAllPortsAreOpen(this.props.blocks["bs"])
      ? false
      : true;

    if (openPortsButton) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.openNewPort(this.props.blocks["bs"]);
      }, 2000);
    }
    const handleFileRead = (e) => {
      const content = JSON.parse(fileReader.result);
      let payload = {
        projectName: content.projectName,
        projectDescription: content.projectDescription,
        blocks: content.blocks,
      };
      createProject(payload)
        .then((data) => {
          showToastr("success", "Project imported successfully");
          this.upload.value = "";
          window.location = data.project_id;
        })
        .catch((error) => {
          showToastrError("fhfh", error);
        });
    };
    const handleFileChosen = (file) => {
      fileReader = new FileReader();
      fileReader.onloadend = handleFileRead;
      fileReader.readAsText(file);
    };

    return (
      (this.state.isLoadingComp && (
        <div class="loading">Loading&#8230;</div>
      )) || (
        <React.Fragment>
          <NavigationPrompt
            renderIfNotActive={true}
            when={(crntLocation, nextLocation) => {
              if (
                this.state.isProjectChanged &&
                (!nextLocation ||
                  !nextLocation.pathname.startsWith(crntLocation.pathname))
              ) {
                this.setState({ nextLocation: nextLocation });
                return true;
              }
              return false;
            }}
            disableNative={true}
          >
            {({ isActive, onCancel, onConfirm }) => {
              if (isActive) {
                return (
                  <Modal centered show={true}>
                    <div>
                      <Modal.Body>
                        WARNING: you are leaving the project editor. You have
                        unsaved changes in current project. Please save them or
                        they will be lost.
                      </Modal.Body>
                      <Modal.Footer>
                        <button
                          className="btn btn-info"
                          onClick={() => {
                            this.saveProject(false, () => {
                              if (this.state.nextLocation) {
                                window.location.href =
                                  this.state.nextLocation.pathname;
                              }
                            });
                          }}
                        >
                          Save and Leave
                        </button>

                        <button className="btn btn-success" onClick={onCancel}>
                          Stay On Page
                        </button>
                        <button className="btn btn-warning" onClick={onConfirm}>
                          Leave
                        </button>
                      </Modal.Footer>
                    </div>
                  </Modal>
                );
              }
            }}
          </NavigationPrompt>
          <Navbar
            id="editor-nav-container-fluid"
            light
            expand="md"
            style={{ padding: "0 90px 0 90px" }}
          >
            <div className="editor-nav-container">
              <Nav navbar id="editor-nav-component">
                {isUserLoggedIn() && (
                  <Dropdown
                    nav
                    isOpen={this.state.viewDropdownOpen}
                    toggle={this.toggleViewDropdown}
                  >
                    <DropdownToggle nav caret>
                      Project
                    </DropdownToggle>
                    <DropdownMenu tog>
                      <a
                        onClick={() => {
                          if (
                            this.props.location.pathname ===
                            "/project-editor/new"
                          ) {
                            // borramos
                            localStorage.removeItem("localProject");
                            setTimeout(() => {
                              window.location.reload();
                            }, 300);
                          } else {
                            this.props.history.push("/project-editor/new");
                          }
                        }}
                        className="dropdown-item border-0"
                      >
                        New
                      </a>
                      <NavLink
                        className="dropdown-item border-0"
                        to="/projectsList"
                      >
                        Open
                      </NavLink>
                      <DropdownItem
                        onClick={() => {
                          this.saveProject(false);
                        }}
                      >
                        Save
                      </DropdownItem>
                      {this.props.location.pathname !==
                        "/project-editor/new" && (
                        <DropdownItem
                          onClick={() => {
                            this.saveProject(true);
                          }}
                        >
                          Save As
                        </DropdownItem>
                      )}
                    </DropdownMenu>
                  </Dropdown>
                )}
                <Dropdown
                  nav
                  isOpen={this.state.projectsDropdownOpen}
                  toggle={this.toggleProjectsDropdown}
                >
                  <DropdownToggle nav caret>
                    View
                  </DropdownToggle>
                  <DropdownMenu tog>
                    <DropdownItem
                      disabled={this.state.view === "Floating"}
                      onClick={() =>
                        this.setState({ view: "Floating" }, () => {
                          localStorage.setItem(
                            "editorView" + this.props.match.params.id,
                            "Floating"
                          );
                        })
                      }
                    >
                      <span
                        className={
                          this.state.view === "Floating" ? "fa fa-check " : ""
                        }
                      ></span>{" "}
                      Floating
                    </DropdownItem>
                    <DropdownItem
                      disabled={this.state.view === "Column"}
                      onClick={() =>
                        this.setState({ view: "Column" }, () => {
                          localStorage.setItem(
                            "editorView" + this.props.match.params.id,
                            "Column"
                          );
                        })
                      }
                    >
                      <span
                        className={
                          this.state.view === "Column" ? "fa fa-check " : ""
                        }
                      ></span>{" "}
                      Column
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
                {isUserLoggedIn() && (
                  <Dropdown
                    nav
                    isOpen={this.state.sharingDropdownOpen}
                    toggle={this.toggleSharingDropdown}
                  >
                    <DropdownToggle nav caret>
                      Sharing
                    </DropdownToggle>
                    <DropdownMenu tog>
                      <div className="nav-link p-0">
                        <input
                          style={{ display: "none" }}
                          ref={(ref) => (this.upload = ref)}
                          type="file"
                          id="projectFile"
                          accept=".json"
                          onChange={(e) => handleFileChosen(e.target.files[0])}
                          className="dropdown-item"
                        />
                        <div
                          className="dropdown-item"
                          onClick={(e) => this.upload.click()}
                        >
                          Import
                        </div>
                      </div>
                      <DropdownItem
                        onClick={() => {
                          this.exportProject();
                        }}
                      >
                        Export
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                )}
                {/* RECENT PROJECTS */}
                {isUserLoggedIn() && (
                  <Dropdown
                    nav
                    isOpen={this.state.recentProjectsDropdownOpen}
                    toggle={this.toggleRecentProjectsDropdown}
                  >
                    <DropdownToggle nav caret>
                      Recent Projects
                    </DropdownToggle>
                    <DropdownMenu tog>
                      {recentP.map((project) => (
                        <NavLink
                          className="dropdown-item border-0"
                          to={"/project-editor/" + project.id}
                        >
                          {project.projectName}
                        </NavLink>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                )}
                <h6 style={{ paddingTop: "10px", paddingLeft: "10px" }}>
                  <span class="badge badge-secondary">
                    OSC IP: 18.224.253.25
                    {/* OSC IP: 18.116.26.75 */}
                  </span>
                </h6>
                {isUserLoggedIn() && (
                  <NavItem
                    style={{
                      color: "white",
                      lineHeight: "2.5",
                      marginLeft: "15px",
                    }}
                    id="ActualProject"
                  >
                    <span className="fa fa-project-diagram "></span>&nbsp;
                    Actual project: {this.state.projectName}
                  </NavItem>
                )}
              </Nav>

              <Nav className="ml-auto" navbar>
                <NavItem>
                  <NavLink
                    className="nav-link"
                    to={window.location.pathname}
                    onClick={this.toggleFullScreen}
                  >
                    <span className="fa fa-expand " />
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className="nav-link"
                    to={window.location.pathname}
                    onClick={this.toggleFullScreen}
                  >
                    <span className="fa fa-compress " />
                  </NavLink>
                </NavItem>
              </Nav>
            </div>
          </Navbar>
          <div className="editor-container-fluid">
            <AddBlock />
            <div>
              <div
                className="row"
                style={{ paddingLeft: "65px", overflow: "hidden" }}
              >
                {this.renderBlockList(items, this.props.blocks.nowOut)}
              </div>
            </div>
          </div>
          {/* create new account model */}
          <Modal
            centered
            show={this.state.isRegisterModalOpen}
            onHide={this.toggleRegisterModal}
          >
            <Modal.Header closeButton>
              <Modal.Title>Create new account</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <RegisterForm afterRegister={this.afterRegister} />
            </Modal.Body>
          </Modal>
          {/* log into account */}
          <Modal
            centered
            show={this.state.isLoginModalOpen}
            onHide={this.toggleLoginModal}
          >
            <Modal.Header closeButton>
              <Modal.Title>Login to account</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <LoginForm afterSignin={this.afterSignin} />
              <div
                style={{ color: "#007bff" }}
                onClick={() => {
                  this.toggleLoginModal();
                  this.toggleRegisterModal();
                }}
              >
                New User? Register
              </div>
            </Modal.Body>
          </Modal>
          {/* create new project */}
          <Modal
            centered
            show={this.state.isModalOpen}
            onHide={this.toggleModal}
          >
            <form id="project_create" method="post">
              <Modal.Header closeButton>
                <Modal.Title>
                  {this.props.location.pathname === "/project-editor/new"
                    ? "Create new project"
                    : "Save as"}
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <FormInput
                  className="form-control"
                  type="text"
                  name="projectName"
                  required={true}
                  placeholder="Project Name"
                  value={this.state.projectName}
                  onChange={this.handleOnChange}
                  autoFocus
                />
                <br />
                <FormInput
                  className="form-control"
                  type="text"
                  name="projectDescription"
                  required={true}
                  placeholder="Project Description"
                  value={this.state.projectDescription}
                  onChange={this.handleOnChange}
                />
              </Modal.Body>
              <Modal.Footer>
                <button className="btn btn-warn" onClick={this.toggleModal}>
                  Close
                </button>
                <button
                  onClick={this.createProject}
                  className="btn btn-primary"
                >
                  Create
                </button>
              </Modal.Footer>
            </form>
          </Modal>
          {this.state.isLoadingConn && (
            <div class="loading">Loading&#8230;</div>
          )}
        </React.Fragment>
      )
    );
  }
}

const mapStateToProps = (state) => ({
  blocks: state.blocks,
});

export default withRouter(connect(mapStateToProps)(ProjectEditor));
